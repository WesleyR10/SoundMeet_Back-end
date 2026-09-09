import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { MusicianIndicatedEvent } from "../../core/audience/domain/events/musician-indicated.event";
import { SocialMediaSharedEvent } from "../../core/audience/domain/events/social-media-shared.event";
import { socialShareReference } from "../../core/audience/domain/value-objects/social-share-content";
import { AddPointsUseCase } from "../../core/gamification/application/use-cases/add-points/add-points.use-case";
import { IUserScoreRepository } from "../../core/gamification/domain/user-score.repository";
import { PointsSourceEnum } from "../../core/gamification/domain/value-objects/points-source.vo";
import { ScoreTypeEnum } from "../../core/gamification/domain/value-objects/score-type.vo";
import { RecordIndicationUseCase } from "../../core/indication/application/use-cases/record-indication/record-indication.use-case";

/**
 * Pontos do fã que dependem de eventos do agregado `Audience`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE ISTO NÃO EXISTIA — e por que a ausência era invisível
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `MusicianIndicatedEvent` e `SocialMediaSharedEvent` eram emitidos pelo
 * agregado desde sempre e **nenhum handler os escutava** — nem os use-cases
 * recebiam o `DomainEventMediator`, então nem chegavam a ser publicados. O
 * resultado: as rotas incrementavam `Audience.points` (que alimenta o nível do
 * fã) e o ledger canônico `UserScore`/`UserPoints` — que é o que o leaderboard
 * lê — nunca via nada. Dois sistemas de pontos, divergindo em silêncio.
 *
 * Nada disso quebrava teste ou build: um evento sem ouvinte é código que
 * compila e roda. É o mesmo modo de falha do `MessageSentEvent` do chat, já
 * registrado no roadmap.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 O DEDUPE É A METADE QUE IMPORTA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Compartilhamento e indicação são as únicas ações do sistema **inteiramente
 * auto-declaradas**: nada externo as corrobora. `imageShare.ts` registra no
 * próprio código que o SO não distingue "compartilhou" de "abriu o menu e
 * cancelou". Sem dedupe, um laço sobre a rota rende pontos infinitos — e o
 * leaderboard é público.
 *
 * O dedupe consulta o **ledger**, não uma tabela paralela: `UserScore` já é a
 * fonte de verdade dos pontos, e uma segunda tabela de "o que já foi pago"
 * poderia divergir dele. E é permanente de propósito — `processOnce` (usado em
 * `RequestEventsHandlers`) tem TTL de 24h no Redis, que resolve entrega dupla
 * mas deixaria o mesmo recibo pagar de novo depois de amanhã.
 */
@Injectable()
export class AudienceEventsHandlers {
  private readonly logger = new Logger(AudienceEventsHandlers.name);

  constructor(
    @Inject(AddPointsUseCase)
    private readonly addPointsUseCase: AddPointsUseCase,
    @Inject("UserScoreRepository")
    private readonly userScoreRepo: IUserScoreRepository,
    @Inject(RecordIndicationUseCase)
    private readonly recordIndicationUseCase: RecordIndicationUseCase,
  ) {}

  @OnEvent(SocialMediaSharedEvent.name)
  async handleSocialMediaShared(event: SocialMediaSharedEvent) {
    const audienceId = event.aggregate_id.id;
    const reference = socialShareReference(
      event.content_type,
      event.content_id,
    );

    try {
      const alreadyCredited =
        await this.userScoreRepo.existsByUserTypeAndReference(
          audienceId,
          ScoreTypeEnum.SOCIAL_SHARE,
          reference,
        );

      // Compartilhar de novo é legítimo — mandar o card para outro grupo é uso
      // normal. O que não acontece duas vezes é o CRÉDITO.
      if (alreadyCredited) return;

      await this.addPointsUseCase.execute({
        user_id: audienceId,
        source: PointsSourceEnum.SOCIAL_SHARE,
        metadata: {
          reference_id: reference,
          content_type: event.content_type,
          content_id: event.content_id,
          platform: event.platform,
          description: `Compartilhou ${event.content_type} em ${event.platform}`,
        },
      });
    } catch (error) {
      // Falhar o crédito de pontos NÃO pode derrubar o compartilhamento: o
      // agregado já foi salvo, e a gamificação é acessória ao ato. Mesma
      // postura do handler de request.
      this.logger.error(
        JSON.stringify({
          event: "audience.social_share",
          audience_id: audienceId,
          reference,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  @OnEvent(MusicianIndicatedEvent.name)
  async handleMusicianIndicated(event: MusicianIndicatedEvent) {
    const audienceId = event.aggregate_id.id;
    // Indicar o mesmo músico para o mesmo lugar duas vezes não é duas
    // indicações — é a mesma opinião, repetida.
    const reference = `${event.musician_id}:${event.establishment_id}`;

    /*
     * 🔴 PERSISTIR vem antes de creditar, e as duas coisas falham
     * independentemente.
     *
     * A indicação é o dado de negócio — é o que alimenta a caixa de entrada do
     * estabelecimento e fecha o ciclo B2B. Os pontos do fã são acessórios. Se
     * a ordem fosse invertida e o crédito falhasse, perderíamos a indicação
     * inteira por causa de gamificação.
     */
    try {
      await this.recordIndicationUseCase.execute({
        audience_id: audienceId,
        musician_id: event.musician_id,
        establishment_id: event.establishment_id,
        message: event.message,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "audience.musician_indicated.persist",
          audience_id: audienceId,
          reference,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    try {
      const alreadyCredited =
        await this.userScoreRepo.existsByUserTypeAndReference(
          audienceId,
          ScoreTypeEnum.INDICATION,
          reference,
        );
      if (alreadyCredited) return;

      await this.addPointsUseCase.execute({
        user_id: audienceId,
        source: PointsSourceEnum.INDICATION,
        metadata: {
          reference_id: reference,
          musician_id: event.musician_id,
          establishment_id: event.establishment_id,
          description: "Indicou um músico para um estabelecimento",
        },
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "audience.musician_indicated",
          audience_id: audienceId,
          reference,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
