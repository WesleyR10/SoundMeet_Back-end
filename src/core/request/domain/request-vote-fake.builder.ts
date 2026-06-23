import { v4 as uuidv4 } from "uuid";

import { RequestVote, RequestVoteId } from "./request-vote.aggregate";
import { RequestVoteType } from "./value-objects/request-vote-type.vo";

type PropOrFactory<T> = T | ((index: number) => T);

export class RequestVoteFakeBuilder<TBuild = any> {
  private _request_vote_id: PropOrFactory<RequestVoteId> | undefined =
    undefined;
  private _request_id: PropOrFactory<string> = (_index) => uuidv4();
  private _audience_id: PropOrFactory<string> = (_index) => uuidv4();
  private _vote_type: PropOrFactory<RequestVoteType> = (_index) =>
    RequestVoteType.UP;
  private _created_at: PropOrFactory<Date> = (_index) => new Date();

  private countObjs;

  static aVote() {
    return new RequestVoteFakeBuilder<RequestVote>();
  }

  static theVotes(countObjs: number) {
    return new RequestVoteFakeBuilder<RequestVote[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
  }

  withVoteId(valueOrFactory: PropOrFactory<RequestVoteId>) {
    this._request_vote_id = valueOrFactory;
    return this;
  }

  withRequestId(valueOrFactory: PropOrFactory<string>) {
    this._request_id = valueOrFactory;
    return this;
  }

  withAudienceId(valueOrFactory: PropOrFactory<string>) {
    this._audience_id = valueOrFactory;
    return this;
  }

  upVote() {
    this._vote_type = () => RequestVoteType.UP;
    return this;
  }

  downVote() {
    this._vote_type = () => RequestVoteType.DOWN;
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  build(): TBuild {
    const votes = new Array(this.countObjs).fill(undefined).map((_, index) => {
      const vote = new RequestVote({
        request_vote_id: !this._request_vote_id
          ? undefined
          : this.callFactory(this._request_vote_id, index),
        request_id: this.callFactory(this._request_id, index),
        audience_id: this.callFactory(this._audience_id, index),
        vote_type: this.callFactory(this._vote_type, index),
        created_at: this.callFactory(this._created_at, index),
      });
      vote.validate();
      return vote;
    });
    return this.countObjs === 1 ? (votes[0] as any) : (votes as any);
  }

  get request_id() {
    return this.getValue("request_id");
  }

  get audience_id() {
    return this.getValue("audience_id");
  }

  get vote_type() {
    return this.getValue("vote_type");
  }

  private getValue(prop: any) {
    const privateProp = `_${prop}` as keyof this;
    return this.callFactory(this[privateProp], 0);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
