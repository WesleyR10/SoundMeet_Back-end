import { Chance } from "chance";

import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import {
  AudienceSpotifyLink,
  AudienceSpotifyLinkId,
} from "./audience-spotify-link.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

const HOUR_MS = 3_600_000;

export class AudienceSpotifyLinkFakeBuilder<TBuild = any> {
  private _link_id: PropOrFactory<AudienceSpotifyLinkId> | undefined =
    undefined;
  private _audience_id: PropOrFactory<Uuid> | undefined = undefined;
  private _spotify_user_id: PropOrFactory<string> | undefined = undefined;
  private _access_token: PropOrFactory<string> | undefined = undefined;
  private _refresh_token: PropOrFactory<string> | undefined = undefined;
  private _expires_at: PropOrFactory<Date> | undefined = undefined;
  private _created_at: PropOrFactory<Date> | undefined = undefined;
  private _updated_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs: number;
  private chance: Chance.Chance;

  static aLink() {
    return new AudienceSpotifyLinkFakeBuilder<AudienceSpotifyLink>();
  }

  static theLinks(countObjs: number) {
    return new AudienceSpotifyLinkFakeBuilder<AudienceSpotifyLink[]>(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withLinkId(v: PropOrFactory<AudienceSpotifyLinkId>) {
    this._link_id = v;
    return this;
  }

  withAudienceId(v: PropOrFactory<Uuid>) {
    this._audience_id = v;
    return this;
  }

  withSpotifyUserId(v: PropOrFactory<string>) {
    this._spotify_user_id = v;
    return this;
  }

  withAccessToken(v: PropOrFactory<string>) {
    this._access_token = v;
    return this;
  }

  withRefreshToken(v: PropOrFactory<string>) {
    this._refresh_token = v;
    return this;
  }

  withExpiresAt(v: PropOrFactory<Date>) {
    this._expires_at = v;
    return this;
  }

  /** Token já vencido — o estado que o job de renovação procura. */
  expired() {
    this._expires_at = new Date(Date.now() - HOUR_MS);
    return this;
  }

  withCreatedAt(v: PropOrFactory<Date>) {
    this._created_at = v;
    return this;
  }

  withUpdatedAt(v: PropOrFactory<Date>) {
    this._updated_at = v;
    return this;
  }

  build(): TBuild {
    const links = new Array(this.countObjs).fill(undefined).map(
      (_, index) =>
        new AudienceSpotifyLink({
          link_id: this.callFactory(this._link_id, index) as
            | AudienceSpotifyLinkId
            | undefined,
          audience_id:
            (this.callFactory(this._audience_id, index) as Uuid) ?? new Uuid(),
          spotify_user_id:
            (this.callFactory(this._spotify_user_id, index) as string) ??
            this.chance.string({ length: 12, alpha: true, numeric: true }),
          access_token:
            (this.callFactory(this._access_token, index) as string) ??
            `access_${this.chance.guid()}`,
          refresh_token:
            (this.callFactory(this._refresh_token, index) as string) ??
            `refresh_${this.chance.guid()}`,
          expires_at:
            (this.callFactory(this._expires_at, index) as Date) ??
            new Date(Date.now() + HOUR_MS),
          created_at: this.callFactory(this._created_at, index) as
            | Date
            | undefined,
          updated_at: this.callFactory(this._updated_at, index) as
            | Date
            | undefined,
        }),
    );

    return (this.countObjs === 1 ? links[0] : links) as TBuild;
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
