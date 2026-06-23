import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsString, IsUUID } from "class-validator";

import { RequestVoteType } from "../../../core/request/domain/value-objects/request-vote-type.vo";

export class VoteRequestDto {
  @ApiProperty({ format: "uuid" })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  audience_id: string;

  @ApiProperty({ enum: Object.values(RequestVoteType) })
  @IsString()
  @IsIn(Object.values(RequestVoteType))
  vote_type: RequestVoteType;
}
