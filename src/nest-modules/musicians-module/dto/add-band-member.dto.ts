import { OmitType } from "@nestjs/swagger";
import { AddBandMemberInput } from "../../../core/musician/application/use-cases/add-band-member/add-band-member.input";

export class AddBandMemberInputWithoutBandId extends OmitType(
  AddBandMemberInput,
  ["band_id"] as const,
) {}

export class AddBandMemberDto extends AddBandMemberInputWithoutBandId {}
