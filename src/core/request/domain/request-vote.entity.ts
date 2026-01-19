import { AggregateRoot, Uuid } from "../../shared/domain";
import { RequestVoteValidatorFactory } from "./request-vote.validator";
import { RequestVoteFakeBuilder } from "./request-vote-fake.builder";

export class RequestVoteId extends Uuid {}

export enum RequestVoteType {
  UP = "up",
  DOWN = "down",
}

export type RequestVoteConstructorProps = {
  vote_id?: RequestVoteId;
  request_id: string;
  audience_id: string;
  vote_type: RequestVoteType | string;
  created_at?: Date;
};

export type RequestVoteCreateCommand = {
  request_id: string;
  audience_id: string;
  vote_type: RequestVoteType | string;
};

export class RequestVote extends AggregateRoot {
  vote_id: RequestVoteId;
  request_id: Uuid;
  audience_id: Uuid;
  vote_type: RequestVoteType;
  created_at: Date;

  constructor(props: RequestVoteConstructorProps) {
    super();
    this.vote_id = props.vote_id ?? new RequestVoteId();
    this.request_id = new Uuid(props.request_id);
    this.audience_id = new Uuid(props.audience_id);
    this.vote_type =
      props.vote_type === RequestVoteType.DOWN
        ? RequestVoteType.DOWN
        : RequestVoteType.UP;
    this.created_at = props.created_at ?? new Date();
  }

  get entity_id(): RequestVoteId {
    return this.vote_id;
  }

  static create(command: RequestVoteCreateCommand): RequestVote {
    const vote = new RequestVote(command);
    vote.validate();
    return vote;
  }

  static fake() {
    return RequestVoteFakeBuilder;
  }

  validate(fields?: string[]) {
    const validator = RequestVoteValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  toJSON() {
    return {
      vote_id: this.vote_id.id,
      request_id: this.request_id.id,
      audience_id: this.audience_id.id,
      vote_type: this.vote_type,
      created_at: this.created_at,
    };
  }
}
