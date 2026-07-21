import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { EncryptedPayload } from "../../shared/domain/encryption.service";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { GoogleCalendarIntegrationValidatorFactory } from "./google-calendar-integration.validator";
import { GoogleCalendarIntegrationFakeBuilder } from "./google-calendar-integration-fake.builder";

export class GoogleCalendarIntegrationId extends Uuid {}

export type GoogleCalendarIntegrationConstructorProps = {
  integration_id?: GoogleCalendarIntegrationId;
  musician_id: Uuid;
  google_account_email: string;
  access_token_encrypted?: EncryptedPayload | null;
  refresh_token_encrypted?: EncryptedPayload | null;
  token_expires_at?: Date | null;
  scope?: string | null;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
};

export type GoogleCalendarIntegrationConnectCommand = {
  musician_id: string;
  google_account_email: string;
  access_token_encrypted: EncryptedPayload;
  refresh_token_encrypted: EncryptedPayload;
  token_expires_at: Date;
  scope: string;
};

export class GoogleCalendarIntegration extends AggregateRoot {
  integration_id: GoogleCalendarIntegrationId;
  musician_id: Uuid;
  google_account_email: string;
  access_token_encrypted: EncryptedPayload | null;
  refresh_token_encrypted: EncryptedPayload | null;
  token_expires_at: Date | null;
  scope: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(props: GoogleCalendarIntegrationConstructorProps) {
    super();
    this.integration_id =
      props.integration_id ?? new GoogleCalendarIntegrationId();
    this.musician_id = props.musician_id;
    this.google_account_email = props.google_account_email;
    this.access_token_encrypted = props.access_token_encrypted ?? null;
    this.refresh_token_encrypted = props.refresh_token_encrypted ?? null;
    this.token_expires_at = props.token_expires_at ?? null;
    this.scope = props.scope ?? null;
    this.is_active = props.is_active ?? true;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): GoogleCalendarIntegrationId {
    return this.integration_id;
  }

  static create(
    command: GoogleCalendarIntegrationConnectCommand,
  ): GoogleCalendarIntegration {
    const integration = new GoogleCalendarIntegration({
      musician_id: new Uuid(command.musician_id),
      google_account_email: command.google_account_email,
      access_token_encrypted: command.access_token_encrypted,
      refresh_token_encrypted: command.refresh_token_encrypted,
      token_expires_at: command.token_expires_at,
      scope: command.scope,
      is_active: true,
    });
    integration.validate();
    return integration;
  }

  /**
   * Reconexão sobre uma linha existente (upsert por musician_id) — substitui
   * tokens/conta e reativa, preservando o id e o histórico de created_at.
   */
  reconnect(
    command: Omit<GoogleCalendarIntegrationConnectCommand, "musician_id">,
  ): void {
    this.google_account_email = command.google_account_email;
    this.access_token_encrypted = command.access_token_encrypted;
    this.refresh_token_encrypted = command.refresh_token_encrypted;
    this.token_expires_at = command.token_expires_at;
    this.scope = command.scope;
    this.is_active = true;
    this.updated_at = new Date();
    this.validate();
  }

  refreshAccessToken(
    access_token_encrypted: EncryptedPayload,
    token_expires_at: Date,
  ): void {
    this.access_token_encrypted = access_token_encrypted;
    this.token_expires_at = token_expires_at;
    this.updated_at = new Date();
  }

  /**
   * Desconecta zerando os tokens cifrados imediatamente (nunca reter segredo
   * revogado em repouso). Mantém a linha e o e-mail para histórico/suporte.
   * Usado tanto no disconnect voluntário quanto quando o Google revoga o
   * refresh token (invalid_grant) — nos dois casos o músico precisa reconectar.
   */
  deactivate(): void {
    this.access_token_encrypted = null;
    this.refresh_token_encrypted = null;
    this.token_expires_at = null;
    this.is_active = false;
    this.updated_at = new Date();
  }

  isTokenExpired(now: Date, safetyWindowMs = 60_000): boolean {
    if (!this.token_expires_at) {
      return true;
    }
    return this.token_expires_at.getTime() - safetyWindowMs <= now.getTime();
  }

  get isConnected(): boolean {
    return this.is_active && this.refresh_token_encrypted !== null;
  }

  validate(fields?: string[]): boolean {
    const validator = GoogleCalendarIntegrationValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return GoogleCalendarIntegrationFakeBuilder;
  }

  toJSON() {
    return {
      integration_id: this.integration_id.id,
      musician_id: this.musician_id.id,
      google_account_email: this.google_account_email,
      token_expires_at: this.token_expires_at,
      scope: this.scope,
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at,
      // Tokens cifrados intencionalmente fora do toJSON — nunca serializar.
    };
  }
}
