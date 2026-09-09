import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";

import { EstablishmentOwnershipGuard } from "../../auth-module";
import { OWNERSHIP_PARAM_KEY } from "../../auth-module/ownership/ownership-param.decorator";
import { EstablishmentIndicationsController } from "../establishment-indications.controller";
import { IndicationsModule } from "../indications.module";

/**
 * Fiação que não precisa de infraestrutura — mesmo escopo (e mesmas
 * limitações) do `di-check.spec.ts` do `performance-module`: quem prova o grafo
 * de DI é o boot da aplicação, porque compilar o módulo aqui puxaria broker.
 */
describe("IndicationsModule (sem infra)", () => {
  it("registra o controller do estabelecimento", () => {
    const controllers: unknown[] =
      Reflect.getMetadata("controllers", IndicationsModule) ?? [];
    expect(controllers).toContain(EstablishmentIndicationsController);
  });

  /*
   * 🔴 Regressão da armadilha do `:id` de sub-recurso.
   *
   * O ownership guard resolve por convenção quando não há `@OwnershipParam`,
   * e "id" é um dos nomes do fallback. Numa rota aninhada, o `:id` do FILHO
   * seria comparado com as claims do dono e daria 403 no estabelecimento
   * legítimo — exatamente o que aconteceu em `personal-chord-sheet`.
   *
   * As duas metades precisam valer: o parâmetro se chama `indication_id`, e o
   * `@OwnershipParam` aponta explicitamente para `establishment_id`.
   */
  it("usa :indication_id no sub-recurso, nunca :id", () => {
    const proto =
      EstablishmentIndicationsController.prototype as unknown as Record<
        string,
        object
      >;
    const path = Reflect.getMetadata(PATH_METADATA, proto.updateStatus);
    expect(path).toBe(":establishment_id/indications/:indication_id");
    expect(path).not.toContain("/:id");
  });

  it.each(["list", "updateStatus"])(
    "%s declara @OwnershipParam apontando para establishment_id",
    (method) => {
      const proto =
        EstablishmentIndicationsController.prototype as unknown as Record<
          string,
          object
        >;
      const options = Reflect.getMetadata(OWNERSHIP_PARAM_KEY, proto[method]);
      expect(options).toEqual({ param: "establishment_id" });
    },
  );

  it.each(["list", "updateStatus"])(
    "%s está atrás do EstablishmentOwnershipGuard",
    (method) => {
      const proto =
        EstablishmentIndicationsController.prototype as unknown as Record<
          string,
          object
        >;
      const guards: unknown[] =
        Reflect.getMetadata(GUARDS_METADATA, proto[method]) ?? [];
      expect(guards).toContain(EstablishmentOwnershipGuard);
    },
  );
});
