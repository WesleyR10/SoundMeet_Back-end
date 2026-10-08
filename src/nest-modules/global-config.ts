import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
  ValidationPipeOptions,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { GlobalExceptionFilter } from "./shared-module/filters/global-exception.filter";
import { NotFoundErrorFilter } from "./shared-module/filters/not-found-error.filter";
import { WrapperDataInterceptor } from "./shared-module/interceptors/wrapper-data/wrapper-data.interceptor";

/**
 * Opções do ValidationPipe **global** (HTTP), exportadas de propósito.
 *
 * 🔴 Um teste de DTO que monta o seu próprio `new ValidationPipe({...})` afirma
 * cobrir a fronteira HTTP, mas na verdade cobre a fronteira que ELE inventou.
 * Foi o que aconteceu com o `forbidNonWhitelisted` (INP-1): a produção ligou,
 * as três specs de DTO continuaram com a config antiga e seguiram verdes
 * descrevendo o comportamento que a produção tinha deixado de ter. Apagar a
 * linha de `forbidNonWhitelisted` daqui não quebraria nenhuma delas.
 *
 * Com a config em um lugar só, o pipe do teste É o de produção — divergir passa
 * a ser impossível em vez de improvável.
 */
export const GLOBAL_VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  errorHttpStatusCode: 422,
  transform: true,
  // Remove do body qualquer propriedade sem decorator no DTO — proteção
  // contra mass-assignment (vários controllers fazem spread de `...dto`).
  whitelist: true,
  /*
   * INP-1: `whitelist` sozinho já impedia o ataque — o campo extra some e
   * a request segue 200. O que faltava era o ALARME: ninguém nunca soube
   * que alguém tentou mandar `is_admin`, `balance` ou `plan_tier` num
   * PATCH, porque o descarte é silencioso por desenho.
   *
   * Com `forbidNonWhitelisted` a tentativa vira 422 e aparece no log de
   * erro. A defesa é a mesma; o que muda é que agora ela é observável.
   *
   * ⚠️ Vale só para o ValidationPipe **global** (HTTP). Os pipes dos
   * consumers de RabbitMQ (ai-cifra, ai-audio, synced-lyrics,
   * google-calendar) ficam de fora de propósito — ver o comentário em
   * `ai-cifra.consumers.ts`.
   */
  forbidNonWhitelisted: true,
  validationError: { target: false, value: false },
};

/**
 * Liga o parser de query "extended" (`qs`), que monta objeto aninhado.
 *
 * ⚠️ O Express 5 trocou o padrão para "simple" (querystring do Node): sem isto
 * `?filter[status]=active` chega em `req.query` como a chave literal
 * `"filter[status]"`, o `filter` do DTO fica `undefined`, e toda busca com
 * filtro respondia 200 com a lista INTEIRA (verificado por HTTP em
 * 08/ago/2026: `filter[name]=zzz` devolvia todos os músicos).
 *
 * 🔴 Mora AQUI, e não só no `bootstrap()`, desde out/2026. O `bootstrap()` é o
 * único ponto do sistema que nenhum teste alcança, e os apps de teste
 * (`startApp`) subiam com o parser padrão: um teste e2e de filtro aninhado
 * exercitava um servidor que não era o de produção. Foi parte do motivo de o
 * filtro de preço da busca de músicos passar meses sem filtrar — nenhum teste
 * atravessava a fronteira HTTP com o parser certo.
 */
export function applyExtendedQueryParser(app: INestApplication) {
  const expressApp = app as unknown as {
    set?: (setting: string, value: string) => unknown;
  };
  if (typeof expressApp.set === "function") {
    expressApp.set("query parser", "extended");
  }
}

export function applyGlobalConfig(app: INestApplication) {
  applyExtendedQueryParser(app);
  app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS));
  app.useGlobalInterceptors(
    new WrapperDataInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );
  app.useGlobalFilters(new NotFoundErrorFilter(), new GlobalExceptionFilter());
}
