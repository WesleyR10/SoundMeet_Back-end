import { IsIn, IsNotEmpty, IsString, IsUUID } from "class-validator";

export type VoteSongInputConstructorProps = {
  audience_id: string;
  request_id: string;
  vote: "up" | "down";
};

export class VoteSongInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  audience_id: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  request_id: string;

  @IsString()
  @IsIn(["up", "down"])
  vote: "up" | "down";

  constructor(props: VoteSongInputConstructorProps) {
    if (!props) return;
    this.audience_id = props.audience_id;
    this.request_id = props.request_id;
    this.vote = props.vote;
  }
}
