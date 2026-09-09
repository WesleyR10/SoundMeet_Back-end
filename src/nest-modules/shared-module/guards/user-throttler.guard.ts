import { Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from "@nestjs/throttler";

import { AuthJwtVerifier } from "../../auth-module/auth-jwt.verifier";

/**
 * Rate limit por USUÁRIO, com fallback para IP.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O PROBLEMA QUE ISTO RESOLVE (roadmap-web §11, item vermelho)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O `ThrottlerGuard` padrão rastreia por `req.ip`. Isso funciona enquanto cada
 * usuário chega de um IP próprio — que é o caso do app mobile, mas NÃO é o do
 * `soundmeet-web`: lá o browser fala com o BFF (Next.js) e é o BFF que chama
 * esta API. Todas as requisições de todos os operadores do painel saem do
 * mesmo IP, então o limite de `RATE_LIMIT_MAX` (100) por 60s passava a valer
 * para **o app web inteiro somado**, não por pessoa.
 *
 * Medido: uma única abertura da tela de contratações custa a lista + a
 * hidratação de cada artista. Poucas visualizações por minuto esgotavam a cota
 * e o painel inteiro passava a responder 429 — para todo mundo ao mesmo tempo.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE `sub` DO JWT E NÃO `X-Forwarded-For`
 * ════════════════════════════════════════════════════════════════════════════
 *
 * A alternativa seria `app.set("trust proxy", <n>)` + ler `X-Forwarded-For`.
 * Ela exige saber **quantos** proxies existem na frente do processo, e o número
 * muda entre docker-compose, um load balancer e uma CDN. Errar esse número é
 * exatamente como se falsifica origem: com `n` alto demais, o cliente escolhe o
 * próprio IP aparente escrevendo o header. Um mecanismo de defesa cuja
 * configuração correta depende da topologia de deploy é um mecanismo que vai
 * estar errado em algum ambiente.
 *
 * O `sub` do token não tem esse problema — funciona igual em qualquer
 * topologia, com ou sem proxy.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * A ASSINATURA É VERIFICADA DE VERDADE — e isso não era o plano original
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O desenho registrado no §11 aceitava decodificar o token SEM verificar, com o
 * custo explícito de que "quem forjar `sub` ganha baldes novos". Não foi
 * preciso pagar esse custo: o `AuthModule` é `@Global()` e exporta o
 * `AuthJwtVerifier`, que mantém cache das chaves do JWKS
 * (`KEYCLOAK_JWKS_CACHE_TTL_SECONDS`, 300s por padrão). Verificar aqui é
 * criptografia local com chave já em memória, sem round-trip — e derruba o
 * bypass inteiro: para conseguir baldes novos agora é preciso um token
 * **válido**, ou seja, uma conta de verdade no provedor de identidade.
 *
 * O custo é uma verificação RSA a mais por requisição autenticada (o `AuthGuard`
 * fará a sua logo depois). É ruído perto de qualquer ida ao banco, e o guard
 * global não tem como reaproveitar o trabalho do guard de controller — a ordem
 * é global primeiro, e é justamente por isso que `request.user` ainda não
 * existe quando chegamos aqui.
 *
 * ⚠️ **Nunca lançar daqui.** Token ausente, expirado, malformado ou de outro
 * emissor cai em IP silenciosamente. Quem decide se a requisição está
 * autenticada é o `AuthGuard`; um 401 vindo do rate limiter mataria toda rota
 * `@Public()` que recebe um Bearer velho por tabela — que é o comportamento
 * normal do app, conforme o soft-auth documentado em `auth.guard.ts`.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwtVerifier: AuthJwtVerifier,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const token = this.extractBearerToken(req);

    if (token) {
      try {
        const payload = await this.jwtVerifier.verify(token);
        const sub = payload?.sub;

        if (typeof sub === "string" && sub.length > 0) {
          // Prefixo para o balde de um usuário nunca colidir com o de um IP —
          // um `sub` que por acaso fosse igual a um endereço somaria as duas
          // contagens.
          return `user:${sub}`;
        }
      } catch {
        // Degrada para IP — ver a nota sobre nunca lançar daqui.
      }
    }

    return super.getTracker(req);
  }

  private extractBearerToken(req: Record<string, any>): string | undefined {
    const authorization = req?.headers?.authorization;
    if (typeof authorization !== "string") {
      return undefined;
    }

    const [type, token] = authorization.split(" ");
    return type === "Bearer" && token ? token : undefined;
  }
}
