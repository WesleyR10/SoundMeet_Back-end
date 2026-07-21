import { OmitType } from "@nestjs/swagger";

import { InviteBandMemberInput } from "../../../core/musician/application/use-cases/invite-band-member/invite-band-member.input";

export class InviteBandMemberInputWithoutBandId extends OmitType(
  InviteBandMemberInput,
  ["band_id"] as const,
) {}

export class InviteBandMemberDto extends InviteBandMemberInputWithoutBandId {}
