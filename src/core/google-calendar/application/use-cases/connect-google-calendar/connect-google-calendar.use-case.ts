import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IEncryptionService } from "../../../../shared/domain/encryption.service";
import { ExternalServiceError } from "../../../../shared/domain/errors/external-service.error";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { GoogleCalendarIntegration } from "../../../domain/google-calendar-integration.aggregate";
import { IGoogleCalendarIntegrationRepository } from "../../../domain/google-calendar-integration.repository";
import {
  GoogleCalendarAuthError,
  GoogleCalendarUnavailableError,
  IGoogleCalendarGateway,
} from "../../ports/google-calendar-gateway.interface";
import {
  GoogleCalendarStatusOutput,
  GoogleCalendarStatusOutputMapper,
} from "../common/google-calendar-integration-output";
import { ConnectGoogleCalendarInput } from "./connect-google-calendar.input";

/**
 * Callback do fluxo OAuth: troca o `code` por tokens, cifra e persiste
 * (upsert por musician_id — reconexão substitui tokens preservando histórico).
 * A validação do `state` assinado acontece ANTES, no controller — aqui o
 * musician_id já chegou autenticado.
 */
export class ConnectGoogleCalendarUseCase implements IUseCase<
  ConnectGoogleCalendarInput,
  GoogleCalendarStatusOutput
> {
  constructor(
    private readonly integrationRepo: IGoogleCalendarIntegrationRepository,
    private readonly gateway: IGoogleCalendarGateway,
    private readonly encryption: IEncryptionService,
    private readonly clock: IClock = { now: () => new Date() },
  ) {}

  async execute(
    input: ConnectGoogleCalendarInput,
  ): Promise<GoogleCalendarStatusOutput> {
    let tokens;
    try {
      tokens = await this.gateway.exchangeCodeForTokens(
        input.code,
        input.redirect_uri,
      );
    } catch (error) {
      if (error instanceof GoogleCalendarAuthError) {
        throw new InvalidArgumentError(
          "Código de autorização do Google inválido ou expirado — refaça a conexão",
        );
      }
      if (error instanceof GoogleCalendarUnavailableError) {
        throw new ExternalServiceError(
          "Não foi possível conectar ao Google Calendar",
          { cause: error },
        );
      }
      throw error;
    }

    // Sem refresh token não há sync duradouro (prompt=consent deveria garantir).
    if (!tokens.refresh_token) {
      throw new InvalidArgumentError(
        "O Google não retornou o refresh token — remova o acesso do app na conta Google e conecte novamente",
      );
    }
    if (!tokens.email) {
      throw new InvalidArgumentError(
        "O Google não retornou o e-mail da conta — verifique os escopos concedidos",
      );
    }

    const command = {
      google_account_email: tokens.email,
      access_token_encrypted: this.encryption.encrypt(tokens.access_token),
      refresh_token_encrypted: this.encryption.encrypt(tokens.refresh_token),
      token_expires_at: new Date(
        this.clock.now().getTime() + tokens.expires_in * 1000,
      ),
      scope: tokens.scope,
    };

    const existing = await this.integrationRepo.findByMusicianId(
      input.musician_id,
    );

    if (existing) {
      existing.reconnect(command);
      await this.integrationRepo.update(existing);
      return GoogleCalendarStatusOutputMapper.toOutput(existing);
    }

    const integration = GoogleCalendarIntegration.create({
      musician_id: input.musician_id,
      ...command,
    });
    await this.integrationRepo.insert(integration);
    return GoogleCalendarStatusOutputMapper.toOutput(integration);
  }
}
