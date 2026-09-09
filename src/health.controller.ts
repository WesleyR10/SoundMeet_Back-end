import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";

import { Public } from "./nest-modules/auth-module/auth.decorators";

@SkipThrottle()
@Controller()
export class HealthController {
  /*
   * `@Public()` explícito, não omissão. Até AUTH-2 esta era a única rota do
   * sistema anônima por acidente — nascia aberta porque o `AuthGuard` não era
   * global. Com o guard global ela precisaria do decorator de qualquer forma;
   * o ponto é que agora "aberta" é uma afirmação no código, e não o silêncio.
   *
   * O healthcheck do Docker e o load balancer batem aqui sem credencial, e a
   * resposta não carrega nada além de um literal — nenhuma versão, nenhum
   * estado de dependência, nada que sirva de reconhecimento.
   */
  @Get("health")
  @Public()
  health() {
    return { status: "ok" };
  }
}
