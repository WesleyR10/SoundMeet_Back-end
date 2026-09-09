import { LivePerformanceController } from "../live-performance.controller";
import { PerformanceController } from "../performance.controller";
import { PerformanceModule } from "../performance.module";

/**
 * Checagens de fiação que NÃO precisam de infraestrutura.
 *
 * ⚠️ **A resolução do grafo de DI NÃO é testada aqui**, e a tentativa está
 * registrada porque a conclusão importa: `PerformanceModule` importa
 * `RequestsModule` e companhia, que puxam `RabbitmqModule`, e o
 * `AmqpConnection` **conecta durante o `.compile()`** — estoura em 5s sem
 * broker de pé. Como `.int-spec.ts` neste projeto roda na suíte unitária (com
 * providers mockados, ver `payment.controller.int-spec.ts`) e o `test:e2e` só
 * casa `.e2e-spec.ts`, não existe hoje um lugar onde um teste que exige Docker
 * vivo caiba honestamente.
 *
 * Quem verifica a fiação, então, é o **boot da aplicação** — token de injeção
 * faltando derruba o startup na hora. Um teste que só passa com infra é teste
 * que fica vermelho pelo motivo errado, e motivo errado ensina a ignorar
 * vermelho.
 */
describe("PerformanceModule (sem infra)", () => {
  /**
   * 🔴 Regressão da armadilha de ordem de rota, na versão pior dela: espalhada
   * em dois arquivos.
   *
   * O Nest registra as rotas na ordem do array `controllers`. Se
   * `PerformanceController` (que tem `@Get(":performance_id")`) vier primeiro,
   * `/performances/live` casa como id, o `ParseUUIDPipe` responde 422 e a
   * feature do fã simplesmente deixa de existir — sem erro de compilação, sem
   * erro de startup, e com o `@Get("live")` correto no seu próprio arquivo.
   */
  it("registra o controller do fã ANTES do que tem rota paramétrica", () => {
    const controllers: unknown[] =
      Reflect.getMetadata("controllers", PerformanceModule) ?? [];

    const liveIndex = controllers.indexOf(LivePerformanceController);
    const paramIndex = controllers.indexOf(PerformanceController);

    expect(liveIndex).toBeGreaterThanOrEqual(0);
    expect(paramIndex).toBeGreaterThanOrEqual(0);
    expect(liveIndex).toBeLessThan(paramIndex);
  });
});
