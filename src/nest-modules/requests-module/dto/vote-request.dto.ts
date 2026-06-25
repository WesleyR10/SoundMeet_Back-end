import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString } from "class-validator";

import { RequestVoteType } from "../../../core/request/domain/value-objects/request-vote-type.vo";

export class VoteRequestDto {
  @ApiProperty({ enum: Object.values(RequestVoteType) })
  @IsString()
  @IsIn(Object.values(RequestVoteType))
  vote_type: RequestVoteType;
}
