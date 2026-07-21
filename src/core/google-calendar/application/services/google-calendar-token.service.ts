import { IClock } from "../../../shared/application/clock.interface";
import { IEncryptionService } from "../../../shared/domain/encryption.service";
import { GoogleCalendarIntegration } from "../../domain/google-calendar-integration.aggregate";
import { IGoogleCalendarIntegrationRepository } from "../../domain/google-calendar-integration.repository";
import {
  GoogleCalendarAuthError,
  IGoogleCalendarGateway,
} from "../ports/google-calendar-gateway.interface";

/**
 * Ciclo de vida do access token por músico (application layer — o adapter
 * HTTP fica stateless): decifra, renova via refresh token quando expirado e
 * persiste o novo token cifrado. Se o Google revogar o refresh token
 * (invalid_grant), desativa a integração — o músico precisa reconectar.
 */
export class GoogleCalendarTokenService {
  constructor(
    private readonly integrationRepo: IGoogleCalendarIntegrationRepository,
    private readonly gateway: IGoogleCalendarGateway,
    private readonly encryption: IEncryptionService,
    private readonly clock: IClock = { now: () => new Date() },
  ) {}

  async getValidAccessToken(
    integration: GoogleCalendarIntegration,
  ): Promise<string> {
    if (!integration.isConnected || !integration.refresh_token_encrypted) {
      throw new GoogleCalendarAuthError(
        "Integração com o Google Calendar inativa — reconexão necessária",
      );
    }

    if (
      !integration.isTokenExpired(this.clock.now()) &&
      integration.access_token_encrypted
    ) {
      return this.encryption.decrypt(integration.access_token_encrypted);
    }

    const refreshToken = this.encryption.decrypt(
      integration.refresh_token_encrypted,
    );

    try {
      const tokens = await this.gateway.refreshAccessToken(refreshToken);
      integration.refreshAccessToken(
        this.encryption.encrypt(tokens.access_token),
        new Date(this.clock.now().getTime() + tokens.expires_in * 1000),
      );
      await this.integrationRepo.update(integration);
      return tokens.access_token;
    } catch (error) {
      if (error instanceof GoogleCalendarAuthError) {
        integration.deactivate();
        await this.integrationRepo.update(integration);
      }
      throw error;
    }
  }
}
