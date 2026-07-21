import {
  Controller,
  Get,
  Header,
  Inject,
  Logger,
  Query,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";

import { ConnectGoogleCalendarUseCase } from "../../core/google-calendar/application/use-cases/connect-google-calendar/connect-google-calendar.use-case";
import { Public } from "../auth-module/auth.decorators";
import { EnvConfig } from "../config-module/config.schema";
import {
  GoogleCalendarOAuthStateService,
  InvalidOAuthStateError,
} from "./google-calendar-oauth-state.service";

/**
 * Callback do OAuth do Google — rota FIXA (o Google exige redirect URI de
 * correspondência exata registrada no Console; por isso não é aninhada em
 * /musicians/:musician_id). É um redirect de navegador sem Bearer token:
 * a autenticidade vem 100% do `state` assinado (HMAC + expiração), validado
 * ANTES de qualquer troca de code com o Google.
 */
@ApiExcludeController()
@Public()
@Controller("google-calendar/oauth")
export class GoogleCalendarCallbackController {
  private readonly logger = new Logger(GoogleCalendarCallbackController.name);

  @Inject(ConnectGoogleCalendarUseCase)
  private connectUseCase: ConnectGoogleCalendarUseCase;

  @Inject(GoogleCalendarOAuthStateService)
  private oauthStateService: GoogleCalendarOAuthStateService;

  constructor(private readonly configService: ConfigService<EnvConfig>) {}

  @Get("callback")
  @SkipThrottle()
  @Header("Content-Type", "text/html; charset=utf-8")
  async callback(
    @Query("code") code?: string,
    @Query("state") state?: string,
    @Query("error") error?: string,
  ): Promise<string> {
    // Usuário cancelou o consentimento na tela do Google.
    if (error) {
      return this.htmlPage(
        "Conexão cancelada",
        "Você não autorizou o acesso ao Google Calendar. Volte ao aplicativo e tente novamente quando quiser.",
      );
    }

    let musician_id: string;
    try {
      ({ musician_id } = this.oauthStateService.verify(state ?? ""));
    } catch (stateError) {
      if (stateError instanceof InvalidOAuthStateError) {
        // Log sem o state bruto — pode ter sido forjado, não poluir o log.
        this.logger.warn(
          JSON.stringify({ event: "google_calendar.invalid_oauth_state" }),
        );
        throw new UnprocessableEntityException(
          "state inválido ou expirado — reinicie a conexão pelo aplicativo",
        );
      }
      throw stateError;
    }

    if (!code) {
      throw new UnprocessableEntityException(
        "code ausente no callback do Google",
      );
    }

    const output = await this.connectUseCase.execute({
      musician_id,
      code,
      redirect_uri:
        this.configService.get<string>("GOOGLE_CALENDAR_REDIRECT_URI") ?? "",
    });

    return this.htmlPage(
      "Google Calendar conectado",
      `Conta <strong>${this.escapeHtml(output.google_account_email ?? "")}</strong> conectada. ` +
        "Seus shows confirmados no SoundMeet aparecerão automaticamente na sua agenda. " +
        "Você já pode voltar ao aplicativo.",
    );
  }

  private htmlPage(title: string, message: string): string {
    return (
      "<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'>" +
      "<meta name='viewport' content='width=device-width, initial-scale=1'>" +
      `<title>${title} — SoundMeet</title>` +
      "<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f0a1e;color:#f5f3ff}main{max-width:420px;padding:32px;text-align:center}h1{color:#7C3AED;font-size:1.4rem}</style>" +
      `</head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`
    );
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
