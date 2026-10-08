import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";

import { AudienceOwnershipGuard } from "../../auth-module";
import { OWNERSHIP_PARAM_KEY } from "../../auth-module/ownership/ownership-param.decorator";
import { AudienceFollowsController } from "../audience-follows.controller";
import { FollowsModule } from "../follows.module";
import { FollowsSummaryController } from "../follows-summary.controller";

/**
 * Fiação sem infraestrutura — mesmo escopo do `di-check.spec.ts` de
 * `indications-module`. Quem prova o grafo de DI é o boot da aplicação.
 */
describe("FollowsModule (sem infra)", () => {
  const proto = AudienceFollowsController.prototype as unknown as Record<
    string,
    object
  >;

  it("registra os dois controllers", () => {
    const controllers: unknown[] =
      Reflect.getMetadata("controllers", FollowsModule) ?? [];
    expect(controllers).toEqual(
      expect.arrayContaining([
        AudienceFollowsController,
        FollowsSummaryController,
      ]),
    );
  });

  /*
   * 🔴 Armadilha do `:id` de sub-recurso: o ownership guard tem "id" no
   * fallback, e o `:id` do FOLLOW seria comparado com o fã — 403 no dono.
   */
  it.each(["unfollow", "toggleNotifications"])(
    "%s usa :follow_id, nunca :id",
    (method) => {
      const path: string = Reflect.getMetadata(PATH_METADATA, proto[method]);
      expect(path).toContain(":follow_id");
      expect(path).not.toMatch(/\/:id(\/|$)/);
    },
  );

  it.each(["list", "follow", "unfollow", "toggleNotifications"])(
    "%s exige AudienceOwnershipGuard apontando para audience_id",
    (method) => {
      const guards: unknown[] =
        Reflect.getMetadata(GUARDS_METADATA, proto[method]) ?? [];
      expect(guards).toContain(AudienceOwnershipGuard);
      expect(Reflect.getMetadata(OWNERSHIP_PARAM_KEY, proto[method])).toEqual({
        param: "audience_id",
      });
    },
  );
});
