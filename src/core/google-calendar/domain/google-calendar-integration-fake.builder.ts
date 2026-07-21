import { Chance } from "chance";

import { EncryptedPayload } from "../../shared/domain/encryption.service";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import {
  GoogleCalendarIntegration,
  GoogleCalendarIntegrationId,
} from "./google-calendar-integration.aggregate";

type PropOrFactory<T> = T | ((index: number) => T);

const fakeEncrypted = (value: string): EncryptedPayload => ({
  ciphertext: Buffer.from(value, "utf8").toString("base64"),
  iv: "fake-iv",
  authTag: "fake-auth-tag",
});

export class GoogleCalendarIntegrationFakeBuilder<TBuild = any> {
  private _integration_id:
    | PropOrFactory<GoogleCalendarIntegrationId>
    | undefined = undefined;
  private _musician_id: PropOrFactory<Uuid> | undefined = undefined;
  private _google_account_email: PropOrFactory<string> | undefined = undefined;
  private _access_token_encrypted:
    | PropOrFactory<EncryptedPayload | null>
    | undefined = undefined;
  private _refresh_token_encrypted:
    | PropOrFactory<EncryptedPayload | null>
    | undefined = undefined;
  private _token_expires_at: PropOrFactory<Date | null> | undefined = undefined;
  private _scope: PropOrFactory<string | null> | undefined = undefined;
  private _is_active: PropOrFactory<boolean> | undefined = undefined;
  private _created_at: PropOrFactory<Date> | undefined = undefined;
  private _updated_at: PropOrFactory<Date> | undefined = undefined;

  private countObjs;
  private chance: Chance.Chance;

  static aGoogleCalendarIntegration() {
    return new GoogleCalendarIntegrationFakeBuilder<GoogleCalendarIntegration>();
  }

  static theGoogleCalendarIntegrations(countObjs: number) {
    return new GoogleCalendarIntegrationFakeBuilder<
      GoogleCalendarIntegration[]
    >(countObjs);
  }

  private constructor(countObjs: number = 1) {
    this.countObjs = countObjs;
    this.chance = Chance();
  }

  withIntegrationId(
    valueOrFactory: PropOrFactory<GoogleCalendarIntegrationId>,
  ) {
    this._integration_id = valueOrFactory;
    return this;
  }

  withMusicianId(valueOrFactory: PropOrFactory<Uuid>) {
    this._musician_id = valueOrFactory;
    return this;
  }

  withGoogleAccountEmail(valueOrFactory: PropOrFactory<string>) {
    this._google_account_email = valueOrFactory;
    return this;
  }

  withAccessTokenEncrypted(
    valueOrFactory: PropOrFactory<EncryptedPayload | null>,
  ) {
    this._access_token_encrypted = valueOrFactory;
    return this;
  }

  withRefreshTokenEncrypted(
    valueOrFactory: PropOrFactory<EncryptedPayload | null>,
  ) {
    this._refresh_token_encrypted = valueOrFactory;
    return this;
  }

  withTokenExpiresAt(valueOrFactory: PropOrFactory<Date | null>) {
    this._token_expires_at = valueOrFactory;
    return this;
  }

  withScope(valueOrFactory: PropOrFactory<string | null>) {
    this._scope = valueOrFactory;
    return this;
  }

  withIsActive(valueOrFactory: PropOrFactory<boolean>) {
    this._is_active = valueOrFactory;
    return this;
  }

  deactivated() {
    this._is_active = false;
    this._access_token_encrypted = null;
    this._refresh_token_encrypted = null;
    this._token_expires_at = null;
    return this;
  }

  withCreatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._created_at = valueOrFactory;
    return this;
  }

  withUpdatedAt(valueOrFactory: PropOrFactory<Date>) {
    this._updated_at = valueOrFactory;
    return this;
  }

  build(): TBuild {
    const integrations = new Array(this.countObjs)
      .fill(undefined)
      .map((_, index) => {
        return new GoogleCalendarIntegration({
          integration_id:
            this.callFactory(this._integration_id, index) ??
            new GoogleCalendarIntegrationId(),
          musician_id: this.callFactory(this._musician_id, index) ?? new Uuid(),
          google_account_email:
            this.callFactory(this._google_account_email, index) ??
            this.chance.email({ domain: "gmail.com" }),
          access_token_encrypted:
            this._access_token_encrypted !== undefined
              ? this.callFactory(this._access_token_encrypted, index)
              : fakeEncrypted(`access-token-${index}`),
          refresh_token_encrypted:
            this._refresh_token_encrypted !== undefined
              ? this.callFactory(this._refresh_token_encrypted, index)
              : fakeEncrypted(`refresh-token-${index}`),
          token_expires_at:
            this._token_expires_at !== undefined
              ? this.callFactory(this._token_expires_at, index)
              : new Date(Date.now() + 3600 * 1000),
          scope:
            this.callFactory(this._scope, index) ??
            "https://www.googleapis.com/auth/calendar.events",
          is_active: this.callFactory(this._is_active, index) ?? true,
          created_at: this.callFactory(this._created_at, index) ?? new Date(),
          updated_at: this.callFactory(this._updated_at, index) ?? new Date(),
        });
      });
    return this.countObjs === 1
      ? (integrations[0] as any)
      : (integrations as any);
  }

  private callFactory(factoryOrValue: PropOrFactory<any>, index: number) {
    return typeof factoryOrValue === "function"
      ? factoryOrValue(index)
      : factoryOrValue;
  }
}
