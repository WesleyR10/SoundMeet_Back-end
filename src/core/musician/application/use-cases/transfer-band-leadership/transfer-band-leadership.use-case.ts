import { Logger } from "@nestjs/common";

import { IIdentityClaimsWriter } from "../../../../shared/application/identity-claims.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { assertBandIsActive, assertBandLeader } from "../common/band-actor";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { TransferBandLeadershipInput } from "./transfer-band-leadership.input";

/**
 * Passa a liderança da banda para outro integrante aceito.
 *
 * Existe porque o agregado proíbe remover ou rebaixar o líder: sem uma saída
 * explícita, um líder que abandona a banda a deixaria travada para sempre —
 * sem ninguém para aceitar show ou confirmar booking.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 O CLAIM `band_ids` ACOMPANHA O LÍDER
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Até out/2026 este use-case só trocava os papéis no banco. O claim — que põe
 * a agenda, os contratos e as conversas DA BANDA no escopo de quem a
 * representa, e sem o qual `assertNegotiationParticipant` nem chega a olhar a
 * liderança — ficava com quem criou a banda. Resultado, com a rota respondendo
 * 200: a nova líder não confirmava booking (não tinha o claim), o ex-líder
 * também não (não era mais líder), e a banda ficava sem ninguém capaz de
 * fechar um show — exatamente o que esta rota existe para impedir.
 *
 * A ordem é: claim da nova líder → banco → claim do ex-líder.
 *
 *  - Keycloak fora no primeiro passo: nada mudou, a transferência falha.
 *  - Banco falha depois: o claim recém-dado é desfeito (melhor esforço).
 *  - Remover o do ex-líder é melhor esforço. Um claim que sobra NÃO dá poder
 *    de decisão — toda decisão confere a liderança no banco —, só mantém as
 *    negociações da banda visíveis a quem as conduzia até um minuto atrás.
 *
 * ⚠️ A nova líder passa a ALTERAR a banda na hora (isso é lido do banco). Os
 * shows e contratos da banda entram nas listas dela quando o token renovar —
 * no máximo os 15 minutos de vida do access token.
 */
export class TransferBandLeadershipUseCase implements IUseCase<
  TransferBandLeadershipInput,
  BandOutput
> {
  private readonly logger = new Logger(TransferBandLeadershipUseCase.name);

  constructor(
    private readonly bandRepo: IBandRepository,
    private readonly identityClaims?: IIdentityClaimsWriter,
  ) {}

  async execute(input: TransferBandLeadershipInput): Promise<BandOutput> {
    const band = await this.bandRepo.findById(new BandId(input.band_id));

    if (!band) {
      throw new NotFoundError(input.band_id, Band);
    }

    const currentLeader = band.leader;
    if (!currentLeader) {
      throw new EntityValidationError([
        { band_id: ["Band has no leader to transfer from"] },
      ]);
    }

    // Admin opera pela banda (suporte, líder inativo) — nesse caso o "de" é o
    // líder atual, seja ele quem for. Fora isso, só o próprio líder transfere.
    assertBandLeader(band, input, "transferir a liderança da banda");
    assertBandIsActive(band);

    const formerLeaderId = currentLeader.musician_id.id;
    const newLeaderId = input.new_leader_musician_id;

    band.transferLeadership(currentLeader.musician_id, new Uuid(newLeaderId));

    // Antes de tocar no Keycloak: sucessor inválido não pode render claim.
    if (band.notification.hasErrors()) {
      throw new EntityValidationError(band.notification.toJSON());
    }

    await this.identityClaims?.addClaimValue(
      newLeaderId,
      "band_ids",
      band.band_id.id,
    );

    try {
      await this.bandRepo.update(band);
    } catch (error) {
      await this.unlink(newLeaderId, band.band_id.id, "rollback");
      throw error;
    }

    await this.unlink(formerLeaderId, band.band_id.id, "former_leader");

    return BandOutputMapper.toOutput(band);
  }

  private async unlink(
    musician_id: string,
    band_id: string,
    reason: "rollback" | "former_leader",
  ): Promise<void> {
    try {
      await this.identityClaims?.removeClaimValue(
        musician_id,
        "band_ids",
        band_id,
      );
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "band.leadership_claim_unlink_failed",
          reason,
          band_id,
          musician_id,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
