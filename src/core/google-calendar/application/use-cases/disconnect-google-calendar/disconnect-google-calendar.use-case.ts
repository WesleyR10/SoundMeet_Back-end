import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IEncryptionService } from "../../../../shared/domain/encryption.service";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { GoogleCalendarIntegration } from "../../../domain/google-calendar-integration.aggregate";
import { IGoogleCalendarIntegrationRepository } from "../../../domain/google-calendar-integration.repository";
import { IGoogleCalendarGateway } from "../../ports/google-calendar-gateway.interface";

export type DisconnectGoogleCalendarInput = {
  musician_id: string;
};

export type DisconnectGoogleCalendarOutput = {
  disconnected: boolean;
};

export class DisconnectGoogleCalendarUseCase implements IUseCase<
  DisconnectGoogleCalendarInput,
  DisconnectGoogleCalendarOutput
> {
  constructor(
    private readonly integrationRepo: IGoogleCalendarIntegrationRepository,
    private readonly gateway: IGoogleCalendarGateway,
    private readonly encryption: IEncryptionService,
  ) {}

  async execute(
    input: DisconnectGoogleCalendarInput,
  ): Promise<DisconnectGoogleCalendarOutput> {
    const integration = await this.integrationRepo.findByMusicianId(
      input.musician_id,
    );
    if (!integration) {
      throw new NotFoundError(input.musician_id, GoogleCalendarIntegration);
    }

    // Revogação no Google é best-effort — indisponibilidade do Google nunca
    // bloqueia o disconnect; os tokens locais são zerados de qualquer forma.
    if (integration.refresh_token_encrypted) {
      try {
        const refreshToken = this.encryption.decrypt(
          integration.refresh_token_encrypted,
        );
        await this.gateway.revokeToken(refreshToken);
      } catch {
        // Log fica na camada de cima; aqui só garantimos que não propaga.
      }
    }

    integration.deactivate();
    await this.integrationRepo.update(integration);

    return { disconnected: true };
  }
}
