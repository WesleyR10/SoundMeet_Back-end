import { OmitType } from "@nestjs/swagger";

import { TransferBandLeadershipInput } from "../../../core/musician/application/use-cases/transfer-band-leadership/transfer-band-leadership.input";

/**
 * `band_id` vem da URL; `requesting_musician_id` e `is_admin` vêm do JWT.
 * Nenhum dos três pode chegar pelo corpo — quem pede a transferência é o
 * token, não o cliente.
 */
export class TransferBandLeadershipDto extends OmitType(
  TransferBandLeadershipInput,
  ["band_id", "requesting_musician_id", "is_admin"] as const,
) {}
