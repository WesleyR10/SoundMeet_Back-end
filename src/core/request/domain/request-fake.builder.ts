import { Chance } from "chance";
import { v4 as uuidv4 } from "uuid";

import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { Request, RequestId } from "./request.aggregate";
import { RequestStatus } from "./value-objects/request-status.vo";

type PropOrFactory<T> = T | ((index: number) => T);

export class RequestFakeBuilder<TBuild = any> {
  private _id: PropOrFactory<RequestId> | undefined = undefined;
  private _audience_id: PropOrFactory<string> = (_index) => uuidv4();
  private _musician_id: PropOrFactory<string> = (_index) => uuidv4();
  private _song_title: PropOrFactory<string> = (_index) =>
    this.chance.word({ length: 10 });
  private _artist: PropOrFactory<string | null> = (_index) =>
    this.chance.name();
  private _message: PropOrFactory<string | null> = (_index) =>
    this.chance.sentence({ words: 5 });
  private _status: PropOrFactory<RequestStatus> = (_index) =>
    RequestStatus.pending();
  private _rejection_reason: PropOrFactory<string | null> = (_index) => null;
  private _created_at: PropOrFactory<Date> = (_index) => new Date();
  private _responded_at: PropOrFactory<Date | null> = (_index) => null;

  private countObjs;

  static aRequest() {
    return new RequestFakeBuilder<Request>();
  }

  static theRequests(countObjs: number) {
    return new RequestFakeBuilder<Request[]>(countObjs);
  }

  private chance: Chance.Chance;

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withId(valueOrFactory: PropOrFactory<RequestId>) {
    this._id = valueOrFactory;
    return this;
  }

  withAudienceId(valueOrFactory: PropOrFactory<string | Uuid>) {
    this._audience_id =
      typeof valueOrFactory === "function"
        ? (index: number) => {
            const result = valueOrFactory(index);
            return result instanceof Uuid ? result.id : result;
          }
        : valueOrFactory instanceof Uuid
          ? valueOrFactory.id
          : valueOrFactory;
    return this;
  }

  withMusicianId(valueOrFactory: PropOrFactory<string | Uuid>) {
    this._musician_id =
      typeof valueOrFactory === "function"
        ? (index: number) => {
            const result = valueOrFactory(index);
            return result instanceof Uuid ? result.id : result;
          }
        : valueOrFactory instanceof Uuid
          ? valueOrFactory.id
          : valueOrFactory;
    return this;
  }

  withSongTitle(valueOrFactory: PropOrFactory<string>) {
    this._song_title = valueOrFactory;
    return this;
  }

  withArtist(valueOrFactory: PropOrFactory<string | null>) {
    this._artist = valueOrFactory;
    return this;
  }

  withMessage(valueOrFactory: PropOrFactory<string | null>) {
    this._message = valueOrFactory;
    return this;
  }

  withStatus(valueOrFactory: PropOrFactory<RequestStatus>) {
    this._status = valueOrFactory;
    return this;
  }

  withRejectionReason(valueOrFactory: PropOrFactory<string | null>) {
    this._rejection_reason = valueOrFactory;
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  withRespondedAt(valueOrFactory: PropOrFactory<Date | null>) {
    this._responded_at = valueOrFactory;
    return this;
  }

  pending() {
    this._status = () => RequestStatus.pending();
    this._responded_at = () => null;
    this._rejection_reason = () => null;
    return this;
  }

  accepted() {
    this._status = () => RequestStatus.accepted();
    this._responded_at = () => new Date();
    this._rejection_reason = () => null;
    return this;
  }

  rejected() {
    this._status = () => RequestStatus.rejected();
    this._responded_at = () => new Date();
    this._rejection_reason = () => this.chance.sentence({ words: 3 });
    return this;
  }

  withoutMessage() {
    this._message = () => null;
    return this;
  }

  withoutArtist() {
    this._artist = () => null;
    return this;
  }

  build(): TBuild {
    const requests = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        const request = new Request({
          id: !this._id ? undefined : this.callFactory(this._id, index),
          audience_id: this.callFactory(this._audience_id, index),
          musician_id: this.callFactory(this._musician_id, index),
          song_title: this.callFactory(this._song_title, index),
          artist: this.callFactory(this._artist, index),
          message: this.callFactory(this._message, index),
          status: this.callFactory(this._status, index),
          rejection_reason: this.callFactory(this._rejection_reason, index),
          created_at: this.callFactory(this._created_at, index),
          responded_at: this.callFactory(this._responded_at, index),
        });
        request.validate();
        return request;
      });
    return this.countObjs === 1 ? (requests[0] as any) : (requests as any);
  }

  get id() {
    return this.getValue("id");
  }

  get audience_id() {
    return this.getValue("audience_id");
  }

  get musician_id() {
    return this.getValue("musician_id");
  }

  get song_title() {
    return this.getValue("song_title");
  }

  get artist() {
    return this.getValue("artist");
  }

  get message() {
    return this.getValue("message");
  }

  get status() {
    return this.getValue("status");
  }

  get rejection_reason() {
    return this.getValue("rejection_reason");
  }

  get created_at() {
    return this.getValue("created_at");
  }

  get responded_at() {
    return this.getValue("responded_at");
  }

  private getValue(prop: any) {
    const optional = ["id"];
    const privateProp = `_${prop}` as keyof this;
    if (!this[privateProp] && optional.includes(prop)) {
      throw new Error(
        `Property ${prop} not have a factory, use 'with' methods`,
      );
    }
    return this.callFactory(this[privateProp], 0);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
