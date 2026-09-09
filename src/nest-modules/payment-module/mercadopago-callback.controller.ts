import { Controller, Get, Inject, Logger, Query, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Response } from "express";

import { CompleteMercadoPagoConnectionUseCase } from "../../core/payment/application/use-cases/connect-mercadopago/complete-mercadopago-connection.use-case";
import { Public } from "../auth-module";
import { EnvConfig } from "../config-module/config.schema";

/**
 * Callback OAuth do Mercado Pago.
 *
 * ## Por que controller SEPARADO
 *
 * `PaymentController` tem `@UseGuards(AuthGuard, ...)` na classe. Um `@Public()`
 * solto ali dentro é o tipo de exceção que alguém remove sem perceber ao
 * refatorar — e aqui a exceção é o ponto: o provedor redireciona o NAVEGADOR
 * para cá, sem Bearer token. Mesma decisão registrada em
 * `contract-verification.controller.ts`.
 *
 * ## O que substitui a autenticação
 *
 * O `state` assinado (HMAC). Ele carrega o `musician_id`, e sem a verificação
 * qualquer um montaria um `state` apontando para outro artista e vincularia a
 * própria conta de pagamento à conta dele. É a única barreira aqui.
 */
@ApiExcludeController()
@Controller("musicians/mercadopago")
export class MercadoPagoCallbackController {
  private readonly logger = new Logger(MercadoPagoCallbackController.name);

  @Inject(CompleteMercadoPagoConnectionUseCase)
  private completeUseCase: CompleteMercadoPagoConnectionUseCase;

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
     * Nada aqui responde JSON de erro: quem está lendo é um NAVEGADOR, depois
     * de um redirect. Um 422 com corpo JSON deixaria o músico numa página em
     * branco sem saber o que fazer. Todos os caminhos terminam num redirect
     * para o app, com o resultado na query.
     */
    if (error || !code || !state) {
      this.logger.warn(
        JSON.stringify({
          event: "mercadopago.oauth.callback_rejected",
          reason: error ?? "code/state ausentes",
        }),
      );
      return response.redirect(this.appRedirect("erro"));
    }

    try {
      const output = await this.completeUseCase.execute({ code, state });

      this.logger.log(
        JSON.stringify({
          event: "mercadopago.oauth.linked",
          musician_id: output.musician_id,
          mp_user_id: output.mp_user_id,
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
          event: "mercadopago.oauth.link_failed",
          message: err instanceof Error ? err.message : "unknown",
        }),
      );
      return response.redirect(this.appRedirect("erro"));
    }
  }

  private appRedirect(status: "sucesso" | "erro"): string {
    const base =
      this.configService.get<string>("MERCADOPAGO_APP_RETURN_URL") ??
      "soundmeet://carteira/mercadopago";
    return `${base}?status=${status}`;
  }
}
