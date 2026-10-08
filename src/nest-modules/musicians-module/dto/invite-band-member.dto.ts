import { OmitType } from "@nestjs/swagger";

import { InviteBandMemberInput } from "../../../core/musician/application/use-cases/invite-band-member/invite-band-member.input";

/**
 * `band_id` vem da URL; `requesting_musician_id` e `is_admin` vêm do JWT.
 * Sobram `musician_id` e `instrument` — o convite é sempre para integrante.
 */
export class InviteBandMemberDto extends OmitType(InviteBandMemberInput, [
  "band_id",
  "requesting_musician_id",
  "is_admin",
] as const) {}
