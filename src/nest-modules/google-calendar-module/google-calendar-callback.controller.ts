import { Controller, Get, Inject, Logger, Query, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";

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
 *
 * ## Por que redirect para o app, e não uma página
 *
 * Até 24/set/2026 esta rota devolvia uma página HTML dizendo "volte ao
 * aplicativo" — escrita quando a feature não tinha cliente nenhum. Quem abre o
 * consentimento é a Chrome Custom Tab do app (`openAuthSessionAsync`), e ela só
 * fecha sozinha quando o navegador chega no `returnUrl`: com uma página, o
 * músico terminava o fluxo e ficava olhando para uma aba que ele mesmo tinha
 * que fechar, e o app não sabia se deu certo — só que a aba sumiu.
 *
 * Mesma decisão já tomada em `mercadopago-callback.controller.ts`, e agora é
 * uma decisão só no projeto em vez de duas.
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
  async callback(
    @Res() response: Response,
    @Query("code") code?: string,
    @Query("state") state?: string,
    @Query("error") error?: string,
  ): Promise<void> {
    /*
     * Nada aqui responde JSON de erro: quem está lendo é um NAVEGADOR. Um 422
     * com corpo JSON deixaria o músico numa aba com texto de API e sem nada
     * para fazer. Todos os caminhos terminam num redirect para o app.
     */

    // Usuário negou o consentimento na tela do Google. Não é erro nosso, e o
    // app diz isso com outras palavras — daí o status próprio.
    if (error) {
      return response.redirect(this.appRedirect("cancelado"));
    }

    let musician_id: string;
    try {
      ({ musician_id } = this.oauthStateService.verify(state ?? ""));
    } catch (stateError) {
      if (stateError instanceof InvalidOAuthStateError) {
        /*
         * O motivo vai para o LOG, nunca para a query do redirect: um `state`
         * inválido é tentativa de forja ou link velho, e detalhar a causa na
         * URL ensina o atacante o que ajustar. Log sem o state bruto, pelo
         * mesmo motivo.
         */
        this.logger.warn(
          JSON.stringify({ event: "google_calendar.invalid_oauth_state" }),
        );
        return response.redirect(this.appRedirect("erro"));
      }
      throw stateError;
    }

    if (!code) {
      this.logger.warn(
        JSON.stringify({
          event: "google_calendar.callback_rejected",
          reason: "code ausente",
        }),
      );
      return response.redirect(this.appRedirect("erro"));
    }

    try {
      await this.connectUseCase.execute({
        musician_id,
        code,
        redirect_uri:
          this.configService.get<string>("GOOGLE_CALENDAR_REDIRECT_URI") ?? "",
      });

      // O e-mail da conta NÃO vai para o log — é PII, e o status autenticado
      // já o entrega a quem tem direito a ele.
      this.logger.log(
        JSON.stringify({ event: "google_calendar.connected", musician_id }),
      );

      return response.redirect(this.appRedirect("sucesso"));
    } catch (err) {
      this.logger.error(
        JSON.stringify({
          event: "google_calendar.connect_failed",
          musician_id,
          message: err instanceof Error ? err.message : "unknown",
        }),
      );
      return response.redirect(this.appRedirect("erro"));
    }
  }

  /**
   * O e-mail da conta conectada NÃO viaja aqui. Ele sai por
   * `GET /musicians/:id/google-calendar/status`, que é autenticado — colocá-lo
   * na query de um redirect o deixaria no histórico do navegador e em qualquer
   * log de proxy pelo caminho.
   */
  private appRedirect(status: "sucesso" | "cancelado" | "erro"): string {
    const base =
      this.configService.get<string>("GOOGLE_CALENDAR_APP_RETURN_URL") ??
      "soundmeet://agenda/google";
    return `${base}?status=${status}`;
  }
}
