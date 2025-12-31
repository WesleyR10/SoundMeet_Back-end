import { OmitType } from "@nestjs/swagger";

import { VoteSongInput } from "../../../core/audience/application/use-cases/vote-song/vote-song.input";

export class VoteSongInputWithoutAudienceId extends OmitType(VoteSongInput, [
  "audience_id",
] as const) {}

export class VoteSongDto extends VoteSongInputWithoutAudienceId {}
