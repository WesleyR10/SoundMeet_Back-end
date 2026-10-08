import { Logger } from "@nestjs/common";

import { IIdentityClaimsWriter } from "../../../../shared/application/identity-claims.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ConflictError } from "../../../../shared/domain/errors/conflict.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import {
  BandOpenCommitments,
  hasOpenCommitments,
  IBandCommitmentsReader,
} from "../../../domain/band-commitments.reader";
import { assertBandLeader } from "../common/band-actor";
import { DissolveBandInput } from "./dissolve-band.input";

/**
 * `deleted`: a banda não tinha registro em lugar nenhum e a linha foi apagada.
 * `archived`: tinha histórico — fica inativa, fora da busca, e o nome continua
 * nos shows e contratos que ela fez.
 */
export type DissolveBandOutcome = "deleted" | "archived";

export type DissolveBandOutput = { outcome: DissolveBandOutcome };

/**
 * Dissolve a banda — `DELETE /bands/:id`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE NÃO É UM `DELETE` DE LINHA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Até out/2026 este use-case fazia `findById` + `delete`, e isso dava três
 * resultados, nenhum certo:
 *
 * 1. **Banda com qualquer proposta ou conversa não apagava.** `bookings.bandId`
 *    e `inquiries.bandId` são `ON DELETE SET NULL`, mas as duas tabelas têm a
 *    CHECK "músico OU banda, exatamente um". O `SET NULL` viola a CHECK, o
 *    Postgres recusa o DELETE e o erro subia genérico ("Database error").
 * 2. **Banda sem proposta, mas com line-up, gorjeta, contrato ou set, apagava
 *    e deixava órfãos**: o registro do show ficava apontando para ninguém.
 * 3. **Nada olhava o que estava em aberto.** Um show confirmado para sábado,
 *    com contrato assinado e cachê em custódia, não impedia o líder de apagar a
 *    banda — o estabelecimento ficava com um show de ninguém.
 *
 * Hoje são três desfechos, do mais restritivo ao mais simples:
 *
 *  - **Compromisso em aberto → 409**, dizendo o que falta encerrar. Dissolver
 *    não é jeito de cancelar show: cancelar tem rota, regra e aviso próprios.
 *  - **Histórico → arquiva** (`Band.archive`).
 *  - **Nada → apaga**, e o claim `band_ids` do líder sai junto.
 */
export class DissolveBandUseCase implements IUseCase<
  DissolveBandInput,
  DissolveBandOutput
> {
  private readonly logger = new Logger(DissolveBandUseCase.name);

  constructor(
    private readonly bandRepo: IBandRepository,
    private readonly commitments: IBandCommitmentsReader,
    private readonly identityClaims?: IIdentityClaimsWriter,
  ) {}

  async execute(input: DissolveBandInput): Promise<DissolveBandOutput> {
    const bandId = new BandId(input.id);
    const band = await this.bandRepo.findById(bandId);

    if (!band) {
      throw new NotFoundError(input.id, Band);
    }

    assertBandLeader(band, input, "dissolver a banda");

    // Repetir o pedido numa banda já arquivada não é erro: o estado pedido é
    // o estado atual.
    if (band.isArchived) {
      return { outcome: "archived" };
    }

    const { open, has_history } = await this.commitments.summarize(
      bandId,
      new Date(),
    );

    if (hasOpenCommitments(open)) {
      throw new ConflictError(
        `A banda ainda tem compromissos em aberto: ${describeOpen(open)}. Encerre-os antes de dissolver a banda.`,
        { metadata: { band_id: bandId.id, open } },
      );
    }

    if (has_history) {
      return this.archive(band);
    }

    try {
      await this.bandRepo.delete(bandId);
    } catch (error) {
      // Corrida: entre a leitura acima e o DELETE alguém propôs um show, e a
      // CHECK do banco recusou apagar. A banda passou a ter histórico — o
      // desfecho certo é o de quem tem.
      this.logger.warn(
        JSON.stringify({
          event: "band.dissolve_delete_refused",
          band_id: bandId.id,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return this.archive(band);
    }

    // Só depois de apagar: tirar o claim de uma banda que continua existindo
    // esconderia do líder a agenda dela. Melhor esforço — um claim que sobra
    // aponta para uma banda que não existe mais e não autoriza nada.
    const leaderId = band.leader?.musician_id.id;
    if (leaderId && this.identityClaims) {
      try {
        await this.identityClaims.removeClaimValue(
          leaderId,
          "band_ids",
          bandId.id,
        );
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: "band.dissolve_claim_unlink_failed",
            band_id: bandId.id,
            musician_id: leaderId,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }

    return { outcome: "deleted" };
  }

  // O claim do líder FICA: a banda arquivada ainda é dele, e é pelo claim que
  // os shows e contratos antigos dela continuam nas listas dele.
  private async archive(band: Band): Promise<DissolveBandOutput> {
    band.archive();
    await this.bandRepo.update(band);
    return { outcome: "archived" };
  }
}

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

function describeOpen(open: BandOpenCommitments): string {
  const parts: string[] = [];
  if (open.upcoming_bookings > 0) {
    parts.push(
      plural(
        open.upcoming_bookings,
        "show marcado ou proposto",
        "shows marcados ou propostos",
      ),
    );
  }
  if (open.open_inquiries > 0) {
    parts.push(
      plural(
        open.open_inquiries,
        "conversa de contratação em andamento",
        "conversas de contratação em andamento",
      ),
    );
  }
  if (open.held_escrows > 0) {
    parts.push(
      plural(open.held_escrows, "cachê em custódia", "cachês em custódia"),
    );
  }
  if (open.live_performances > 0) {
    parts.push(
      plural(
        open.live_performances,
        "apresentação no ar",
        "apresentações no ar",
      ),
    );
  }
  return parts.join(", ");
}
