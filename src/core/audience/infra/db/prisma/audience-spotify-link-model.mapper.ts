import { AudienceSpotifyLink as PrismaAudienceSpotifyLink } from "@prisma/client";

import { IEncryptionService } from "../../../../shared/domain/encryption.service";
import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import {
  AudienceSpotifyLink,
  AudienceSpotifyLinkId,
} from "../../../domain/audience-spotify-link.aggregate";

/**
 * Domínio ↔ Prisma, com os tokens cifrados na borda.
 *
 * 🔴 **A cifra acontece AQUI, não no agregado.** O domínio trabalha com o token
 * em claro (é o que ele precisa mandar ao provedor); quem nunca pode ver o
 * texto claro é o banco. Cifrar no agregado obrigaria toda regra de negócio a
 * decifrar antes de usar, e a primeira que esquecesse mandaria ciphertext para
 * a API do Spotify.
 *
 * Instância (e não estático) porque depende do `IEncryptionService` — mesmo
 * desenho de `MusicianWalletModelMapper`.
 */
export class AudienceSpotifyLinkModelMapper {
  constructor(private readonly encryption: IEncryptionService) {}

  toModel(entity: AudienceSpotifyLink) {
    const access = this.encryption.encrypt(entity.access_token);
    const refresh = this.encryption.encrypt(entity.refresh_token);

    return {
      id: entity.link_id.id,
      audienceId: entity.audience_id.id,
      spotifyUserId: entity.spotify_user_id,
      accessTokenCiphertext: access.ciphertext,
      accessTokenIv: access.iv,
      accessTokenAuthTag: access.authTag,
      refreshTokenCiphertext: refresh.ciphertext,
      refreshTokenIv: refresh.iv,
      refreshTokenAuthTag: refresh.authTag,
      expiresAt: entity.expires_at,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  toEntity(model: PrismaAudienceSpotifyLink): AudienceSpotifyLink {
    const link = new AudienceSpotifyLink({
      link_id: new AudienceSpotifyLinkId(model.id),
      audience_id: new Uuid(model.audienceId),
      spotify_user_id: model.spotifyUserId,
      access_token: this.encryption.decrypt({
        ciphertext: model.accessTokenCiphertext,
        iv: model.accessTokenIv,
        authTag: model.accessTokenAuthTag,
      }),
      refresh_token: this.encryption.decrypt({
        ciphertext: model.refreshTokenCiphertext,
        iv: model.refreshTokenIv,
        authTag: model.refreshTokenAuthTag,
      }),
      expires_at: model.expiresAt,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });

    link.validate();
    if (link.notification.hasErrors()) {
      throw new LoadEntityError(link.notification.toJSON());
    }

    return link;
  }
}
