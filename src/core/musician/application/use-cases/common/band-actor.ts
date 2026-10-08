import { ForbiddenException } from "@nestjs/common";

import { InvalidOperationError } from "../../../../shared/domain/errors/invalid-operation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Band } from "../../../domain/band.aggregate";

/**
 * Quem está pedindo a operação sobre a banda — derivado do JWT pelo
 * controller, nunca do corpo da requisição.
 */
export type BandActor = {
  /** `sub` do token. */
  requesting_musician_id?: string | null;
  is_admin?: boolean;
};

/**
 * Exige que o ator seja o LÍDER ATUAL da banda (ou admin).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE A LIDERANÇA É LIDA DO BANCO, E NÃO DO CLAIM `band_ids`
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Até out/2026 as rotas de escrita da banda eram guardadas pelo
 * `BandOwnershipGuard`, que conferia o claim `band_ids` do JWT. O claim é uma
 * CÓPIA: só era escrito na criação da banda e nunca acompanhava a liderança.
 * Depois de `PATCH /bands/:id/leadership`:
 *
 *  - a nova líder levava 403 em toda rota da banda (sem claim);
 *  - o ex-líder continuava podendo editar, convidar e APAGAR a banda;
 *  - ninguém confirmava booking: um tinha o claim, a outra a liderança.
 *
 * A rota criada para a banda nunca ficar sem quem decida era exatamente a que
 * a deixava assim, e respondia 200.
 *
 * Token é fotografia de 15 minutos; papel dentro de um agregado muda entre
 * uma requisição e outra. Autorização de escrita se confere na fonte, a cada
 * chamada. O claim continua existindo para ESCOPO de leitura (agenda,
 * contratos e conversas da banda) e passa a acompanhar o líder na
 * transferência — ver `TransferBandLeadershipUseCase`.
 *
 * Falha fechada: sem `sub` não há como provar liderança, e o correto é negar.
 */
export function assertBandLeader(
  band: Band,
  actor: BandActor,
  action: string,
): void {
  if (actor.is_admin) {
    return;
  }

  const requester = actor.requesting_musician_id?.trim();
  if (!requester || !band.isLeader(new Uuid(requester))) {
    throw new ForbiddenException(`Somente o líder da banda pode ${action}.`);
  }
}

/**
 * Banda dissolvida com histórico fica arquivada (`Band.archive`): continua
 * existindo para os shows que fez, e não aceita mais nada.
 */
export function assertBandIsActive(band: Band): void {
  if (band.isArchived) {
    throw new InvalidOperationError(
      "Esta banda foi dissolvida e não pode mais ser alterada.",
    );
  }
}
