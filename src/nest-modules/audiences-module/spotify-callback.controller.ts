import { Controller, Get, Inject, Logger, Query, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Response } from "express";

import { CompleteSpotifyConnectionUseCase } from "../../core/audience/application/use-cases/connect-spotify/complete-spotify-connection.use-case";
import { Public } from "../auth-module";
import { EnvConfig } from "../config-module/config.schema";

/**
 * Callback OAuth do Spotify.
 *
 * ## Por que controller SEPARADO
 *
 * `AudiencesController` tem guards na classe, e um `@Public()` solto lá dentro
 * é o tipo de exceção que alguém remove sem perceber ao refatorar — enquanto
 * aqui a exceção é o ponto: o provedor redireciona o NAVEGADOR para cá, sem
 * Bearer token. Mesma decisão de `mercadopago-callback.controller.ts` e de
 * `contract-verification.controller.ts`.
 *
 * ## O que substitui a autenticação
 *
 * O `state` assinado (HMAC), com `purpose` próprio. Ele carrega o `audience_id`
 * — sem a verificação, qualquer um montaria um `state` apontando para outro fã
 * e vincularia a própria conta Spotify à conta dele. E o `purpose` é o que
 * impede um `state` emitido para o fluxo do Mercado Pago de ser aceito aqui.
 */
@ApiExcludeController()
@Controller("audiences/spotify")
export class SpotifyCallbackController {
  private readonly logger = new Logger(SpotifyCallbackController.name);

  @Inject(CompleteSpotifyConnectionUseCase)
  private completeUseCase: CompleteSpotifyConnectionUseCase;

  @Inject(ConfigService)
  private configService: ConfigService<EnvConfig>;

  @Get("callback")
  @Public()
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string | undefined,
    @Res() response: Response,
  ) {
    /*
     * Nada aqui responde JSON: quem está lendo é um NAVEGADOR, depois de um
     * redirect. Um 422 com corpo JSON deixaria o fã numa página em branco sem
     * saber o que fazer. Todos os caminhos terminam em redirect para o app.
     */
    if (error || !code || !state) {
      this.logger.warn(
        JSON.stringify({
          event: "spotify.oauth.callback_rejected",
          reason: error ?? "code/state ausentes",
        }),
      );
      return response.redirect(this.appRedirect("erro"));
    }

    try {
      const output = await this.completeUseCase.execute({ code, state });

      this.logger.log(
        JSON.stringify({
          event: "spotify.oauth.linked",
          audience_id: output.audience_id,
        }),
      );

      return response.redirect(this.appRedirect("sucesso"));
    } catch (err) {
      /*
       * O motivo vai para o LOG, nunca para a query do redirect: um `state`
       * inválido é tentativa de fraude ou link velho, e detalhar a causa na URL
       * ensina o atacante o que ajustar.
       */
      this.logger.error(
        JSON.stringify({
          event: "spotify.oauth.link_failed",
          message: err instanceof Error ? err.message : "unknown",
        }),
      );
      return response.redirect(this.appRedirect("erro"));
    }
  }

  private appRedirect(status: "sucesso" | "erro"): string {
    const base =
      this.configService.get<string>("SPOTIFY_APP_RETURN_URL") ??
      "soundmeet://perfil/spotify";
    return `${base}?status=${status}`;
  }
}
