import {
  Audience,
  AudienceId,
  IAudienceRepository,
} from "@core/audience/domain";
import {
  Event,
  EventId,
  IEventRepository,
  IVenueLocationPort,
  PresenceVerifier,
} from "@core/events/domain";
import {
  IMusicianRepository,
  Musician,
  MusicianId,
} from "@core/musician/domain";
import { Logger } from "@nestjs/common";

import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { localDayWindow } from "../../../../shared/domain/brazil-timezone";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { InvalidOperationError } from "../../../../shared/domain/errors/invalid-operation.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Money } from "../../../../shared/domain/value-objects/money.vo";
import { CanMakeRequestPolicy } from "../../../domain/policies/can-make-request.policy";
import { IBoostChargePort } from "../../../domain/ports/boost-charge.port";
import { IRepertoireMembershipPort } from "../../../domain/ports/repertoire-membership.port";
import { ITipEligibilityPort } from "../../../domain/ports/tip-eligibility.port";
import { Request } from "../../../domain/request.aggregate";
import {
  IRequestRepository,
  RequestSearchParams,
} from "../../../domain/request.repository";
import { RequestBoost } from "../../../domain/value-objects/request-boost.vo";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import { CreateRequestInput } from "./create-request.input";

export type CreateRequestOutput = RequestOutput;

export class CreateRequestUseCase implements IUseCase<
  CreateRequestInput,
  CreateRequestOutput
> {
  constructor(
    private requestRepo: IRequestRepository,
    private eventRepo: IEventRepository,
    private musicianRepo: IMusicianRepository,
    private audienceRepo: IAudienceRepository,
    /**
     * Obrigatório de propósito, e no MEIO da lista: opcional, um wiring que
     * esquecesse de passá-lo desligaria a restrição de repertório em silêncio
     * — a defesa some sem quebrar nada, que é o padrão de falha que este repo
     * já pagou caro várias vezes. Aqui, esquecer é erro de compilação.
     */
    private readonly repertoireMembership: IRepertoireMembershipPort,
    /**
     * Presença no show, reverificada a cada pedido. Obrigatórios pelo mesmo
     * motivo do `repertoireMembership`: opcionais, um wiring esquecido
     * desligaria a verificação em silêncio.
     */
    private readonly venueLocation: IVenueLocationPort,
    private readonly presenceVerifier: PresenceVerifier,
    private readonly maxRequestsPerUserPerEvent: number,
    private readonly requestCooldownMinutes: number,
    private readonly clock: IClock = { now: () => new Date() },
    private readonly domainEventMediator?: DomainEventMediator,
    /** Piso do destaque pago. Ver `BoostMinimumAmountPolicy`. */
    private readonly minBoostAmount: number = 2,
    /**
     * Só é consultado quando o pedido traz destaque — pedido comum não paga o
     * custo de uma leitura de carteira.
     */
    private readonly tipEligibility?: ITipEligibilityPort,
    /**
     * Cria o PIX do destaque NO PEDIDO (paga antes, destaca depois). Ausente,
     * pedido COM destaque é recusado — nunca se grava um destaque sem cobrança
     * (fail closed). Pedido sem destaque não usa a porta.
     */
    private readonly boostCharge?: IBoostChargePort,
    /**
     * Hora LOCAL, no fuso da casa, em que o dia do limite de pedidos vira
     * (`REQUEST_LIMIT_DAY_START_HOUR`). 6 = dia da noite.
     */
    private readonly requestDayStartHour: number = 6,
  ) {}

  private readonly logger = new Logger(CreateRequestUseCase.name);

  async execute(input: CreateRequestInput): Promise<CreateRequestOutput> {
    const now = this.clock.now();
    const eventId = new EventId(input.event_id);
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError(input.event_id, Event);
    }

    const musicianId = new MusicianId(input.musician_id);
    const musician = await this.musicianRepo.findById(musicianId);
    if (!musician) {
      throw new NotFoundError(input.musician_id, Musician);
    }

    musician.ensureIsActive();
    if (musician.notification.hasErrors()) {
      throw new EntityValidationError(musician.notification.toJSON());
    }

    const audienceId = new AudienceId(input.audience_id);
    const audience = await this.audienceRepo.findById(audienceId);
    if (!audience) {
      throw new NotFoundError(input.audience_id, Audience);
    }

    audience.ensureIsActive();
    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    /*
     * Escopo do pedido — a única barreira REAL do switch do músico.
     *
     * O cliente esconde o texto livre quando `accepts_requests_outside_repertoire`
     * é false, mas esconder um campo não é impedir de mandá-lo. Sem esta
     * checagem o switch seria uma sugestão de UI: um POST direto continuaria
     * passando, e o músico que desligou continuaria recebendo tudo.
     */
    const libraryId = input.library_id?.trim() || null;

    if (libraryId) {
      const belongsToThisMusician =
        await this.repertoireMembership.belongsToMusician(
          libraryId,
          input.musician_id,
        );
      if (!belongsToThisMusician) {
        // Vale para os DOIS modos: `library_id` de terceiro é sempre errado.
        // Fosse checado só no modo restrito, bastaria o músico religar o
        // switch para o pedido passar a gravar a linha de outra pessoa.
        throw new InvalidArgumentError(
          "library_id não pertence ao repertório deste músico",
        );
      }
    } else if (!musician.accepts_requests_outside_repertoire) {
      throw new InvalidOperationError(
        "Este artista só aceita pedidos do próprio repertório. Escolha uma música da lista dele.",
      );
    }

    const isPerformer = await this.eventRepo.isMusicianPerformer(
      eventId,
      input.musician_id,
    );

    const isAttendee = await this.eventRepo.isAudienceAttendee(
      eventId,
      input.audience_id,
    );

    const venue = await this.venueLocation.findVenueCoordinates(
      event.establishment_id.id,
    );
    const presence = this.presenceVerifier.verify(
      input.location ?? null,
      venue,
    );
    if (presence.kind === "venue_without_coords") {
      this.logger.warn(
        `Pedido sem verificação geográfica: casa ${event.establishment_id.id} sem coordenadas (evento ${event.event_id.id})`,
      );
    }

    /*
     * 🔴 O "dia" do limite é o da CASA, nunca o do processo. Com
     * `setHours(0)` num container em UTC o limite zerava à meia-noite UTC —
     * 21h em Brasília, 20h em Manaus, no meio do show — e quem já tinha
     * esgotado os pedidos ganhava outro lote. O fuso vem do endereço da casa
     * (`resolveVenueTimezone`), e o dia começa em `requestDayStartHour`:
     * com meia-noite local, o show das 22h às 2h ainda viraria no meio.
     */
    const venueTimezone = await this.venueLocation.findVenueTimezone(
      event.establishment_id.id,
    );
    const requestDay = localDayWindow(
      now,
      venueTimezone,
      this.requestDayStartHour,
    );

    const requestsTodayInEvent =
      await this.requestRepo.countRequestsByAudienceInPeriodForEvent(
        input.audience_id,
        input.event_id,
        requestDay.start,
        requestDay.end,
      );

    const pendingRequests =
      await this.requestRepo.findPendingRequestsByAudienceAndMusician(
        input.audience_id,
        input.musician_id,
        input.event_id,
      );
    const hasPendingRequestForMusician = pendingRequests.length > 0;

    const cooldownHours = this.requestCooldownMinutes / 60;
    const cooldownSince = new Date(
      now.getTime() - cooldownHours * 60 * 60 * 1000,
    );
    const recentRequestsResult = await this.requestRepo.search(
      RequestSearchParams.create({
        filter: {
          audience_id: input.audience_id,
          created_after: cooldownSince,
        },
        sort: "created_at",
        sort_dir: "desc",
      }),
    );
    const recentRequests = recentRequestsResult.items;

    const candidate = Request.create({
      event_id: input.event_id,
      audience_id: input.audience_id,
      musician_id: input.musician_id,
      library_id: libraryId,
      song_title: input.song_title,
      artist: input.artist,
      message: input.message,
      boost: input.boost
        ? new RequestBoost({
            amount: new Money(input.boost.amount),
            dedication: input.boost.dedication ?? null,
            promised_at: now,
          })
        : null,
    });

    /*
     * 🔴 Elegibilidade é checada AQUI, na criação, e não no aceite.
     *
     * A cobrança só nasce quando o músico aceita; se a falta de conta vinculada
     * só aparecesse lá, o músico aceitaria no meio do show e a cobrança
     * quebraria — com o fã achando que ia pagar e o músico achando que ia
     * receber. Aqui vira um aviso calmo, antes de qualquer promessa.
     *
     * Sem a porta injetada (chamada interna, teste antigo) assume-se elegível:
     * a policy só reprova quando há destaque E a resposta é negativa.
     */
    const musicianAcceptsTips =
      !candidate.boost || !this.tipEligibility
        ? true
        : await this.tipEligibility.acceptsTips(input.musician_id);

    const policy = new CanMakeRequestPolicy();
    const policyResult = policy.evaluate({
      event_status: event.status,
      is_musician_performer: isPerformer,
      is_audience_attendee: isAttendee,
      presence,
      requests_today_in_event: requestsTodayInEvent,
      max_requests_per_user_per_event: this.maxRequestsPerUserPerEvent,
      has_pending_request_for_musician: hasPendingRequestForMusician,
      recent_requests: recentRequests,
      candidate,
      min_boost_amount: this.minBoostAmount,
      musician_accepts_tips: musicianAcceptsTips,
    });

    if (!policyResult.isValid) {
      throw new EntityValidationError(policyResult.errors);
    }

    const entity = candidate;

    if (entity.boost) {
      await this.chargeBoost(entity);
    }

    await this.requestRepo.insert(entity);

    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(entity);
      await this.domainEventMediator.publishIntegrationEvents(entity);
      entity.clearEvents();
    }

    return RequestOutputMapper.toOutput(entity);
  }

  /**
   * 🔴 PAGA ANTES: o PIX do destaque nasce aqui, junto com o pedido — depois
   * das regras (nunca cobrar um pedido que a policy recusaria) e antes de
   * gravar (FK `music_requests.boostTipId -> tips.id`).
   *
   * Se o provedor falhar, o pedido COM destaque não é criado: o fã escolheu
   * pagar para furar a fila, e gravar o pedido sem destaque às escondidas
   * entregaria outra coisa do que ele pediu. Ele tenta de novo ou pede sem.
   * No pior caso sobra um PIX criado e não pago se o `insert` falhar depois —
   * barulho, não dano: ninguém pagou nada.
   */
  private async chargeBoost(entity: Request): Promise<void> {
    if (!this.boostCharge) {
      throw new InvalidOperationError(
        "O destaque pago está indisponível agora. Mande o pedido sem destaque.",
      );
    }

    let tipId: string;
    try {
      const charge = await this.boostCharge.createCharge({
        audience_id: entity.audience_id.id,
        musician_id: entity.musician_id.id,
        event_id: entity.event_id.id,
        amount: entity.boost!.amount.amount,
        dedication: entity.boost!.dedication,
      });
      tipId = charge.tip_id;
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "request.boost.charge_failed",
          musician_id: entity.musician_id.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw new InvalidOperationError(
        "Não foi possível gerar o PIX do destaque agora. Tente de novo ou mande o pedido sem destaque.",
      );
    }

    entity.markBoostAwaitingPayment(tipId);
    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }
  }
}
