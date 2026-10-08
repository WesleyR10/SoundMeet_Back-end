import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Contract } from "../../../domain/contract.aggregate";
import { ContractPartyRole } from "../../../domain/contract-types";

/**
 * De qual lado o requisitante está assinando.
 *
 * 🔴 **Derivado dos claims, nunca recebido do cliente.** Deixar o corpo
 * escolher o papel permitiria ao estabelecimento assinar pelos dois lados e
 * declarar o contrato fechado sozinho.
 *
 * Extraído para módulo próprio quando o segundo fator entrou: o código é
 * emitido para o e-mail de um papel e consumido na assinatura de um papel, e
 * duas cópias dessa regra podiam divergir — emitindo para o contratante e
 * validando como contratado. Uma função, dois chamadores.
 */
export function resolveSigningRole(
  contract: Contract,
  participantIds: string[] | undefined,
): ContractPartyRole {
  const ids = (participantIds ?? []).filter(Boolean);

  const isContracted =
    (!!contract.musician_id && ids.includes(contract.musician_id.id)) ||
    (!!contract.band_id && ids.includes(contract.band_id.id));
  if (isContracted) return "contracted";

  if (ids.includes(contract.establishment_id.id)) return "contractor";

  throw new EntityValidationError([
    {
      role: ["Não foi possível determinar por qual parte você está assinando."],
    },
  ]);
}
