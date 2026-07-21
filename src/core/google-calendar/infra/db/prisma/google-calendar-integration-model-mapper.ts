import { GoogleCalendarIntegration as PrismaGoogleCalendarIntegration } from "@prisma/client";

import { EncryptedPayload } from "../../../../shared/domain/encryption.service";
import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import {
  GoogleCalendarIntegration,
  GoogleCalendarIntegrationId,
} from "../../../domain/google-calendar-integration.aggregate";

export type GoogleCalendarIntegrationModelProps = {
  id: string;
  musicianId: string;
  googleAccountEmail: string;
  accessTokenCiphertext: string | null;
  accessTokenIv: string | null;
  accessTokenAuthTag: string | null;
  refreshTokenCiphertext: string | null;
  refreshTokenIv: string | null;
  refreshTokenAuthTag: string | null;
  tokenExpiresAt: Date | null;
  scope: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

const toEncryptedPayload = (
  ciphertext: string | null,
  iv: string | null,
  authTag: string | null,
): EncryptedPayload | null => {
  if (!ciphertext || !iv || !authTag) {
    return null;
  }
  return { ciphertext, iv, authTag };
};

export class GoogleCalendarIntegrationModelMapper {
  static toModel(
    entity: GoogleCalendarIntegration,
  ): GoogleCalendarIntegrationModelProps {
    return {
      id: entity.integration_id.id,
      musicianId: entity.musician_id.id,
      googleAccountEmail: entity.google_account_email,
      accessTokenCiphertext: entity.access_token_encrypted?.ciphertext ?? null,
      accessTokenIv: entity.access_token_encrypted?.iv ?? null,
      accessTokenAuthTag: entity.access_token_encrypted?.authTag ?? null,
      refreshTokenCiphertext:
        entity.refresh_token_encrypted?.ciphertext ?? null,
      refreshTokenIv: entity.refresh_token_encrypted?.iv ?? null,
      refreshTokenAuthTag: entity.refresh_token_encrypted?.authTag ?? null,
      tokenExpiresAt: entity.token_expires_at,
      scope: entity.scope,
      is_active: entity.is_active,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(
    model: PrismaGoogleCalendarIntegration,
  ): GoogleCalendarIntegration {
    const integration = new GoogleCalendarIntegration({
      integration_id: new GoogleCalendarIntegrationId(model.id),
      musician_id: new Uuid(model.musicianId),
      google_account_email: model.googleAccountEmail,
      access_token_encrypted: toEncryptedPayload(
        model.accessTokenCiphertext,
        model.accessTokenIv,
        model.accessTokenAuthTag,
      ),
      refresh_token_encrypted: toEncryptedPayload(
        model.refreshTokenCiphertext,
        model.refreshTokenIv,
        model.refreshTokenAuthTag,
      ),
      token_expires_at: model.tokenExpiresAt,
      scope: model.scope,
      is_active: model.is_active,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });

    integration.validate();
    if (integration.notification.hasErrors()) {
      throw new LoadEntityError(integration.notification.toJSON());
    }

    return integration;
  }
}
