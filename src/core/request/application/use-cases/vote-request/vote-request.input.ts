import { IsIn, IsNotEmpty, IsString, IsUUID } from "class-validator";

import { RequestVoteType } from "../../../domain/value-objects/request-vote-type.vo";

export type VoteRequestInputConstructorProps = {
  request_id: string;
  audience_id: string;
  vote_type: RequestVoteType | "up" | "down";
};

export class VoteRequestInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  request_id: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  audience_id: string;

  @IsString()
  @IsIn(Object.values(RequestVoteType))
  vote_type: RequestVoteType | "up" | "down";

  constructor(props: VoteRequestInputConstructorProps) {
    if (!props) return;
    this.request_id = props.request_id;
    this.audience_id = props.audience_id;
    this.vote_type = props.vote_type;
  }
}
