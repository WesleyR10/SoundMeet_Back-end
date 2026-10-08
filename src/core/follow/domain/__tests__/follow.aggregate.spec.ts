import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { Follow } from "../follow.aggregate";

describe("Follow", () => {
  it("nasce com avisos ligados", () => {
    const follow = Follow.create({
      audience_id: new Uuid().id,
      target_type: "musician",
      target_id: new Uuid().id,
    });
    expect(follow.notifications_enabled).toBe(true);
  });

  it("recusa tipo de alvo fora da lista (banda fica fora da v1)", () => {
    expect(() =>
      Follow.create({
        audience_id: new Uuid().id,
        target_type: "band" as any,
        target_id: new Uuid().id,
      }),
    ).toThrow(EntityValidationError);
  });

  it("liga e desliga os avisos sem desfazer o vínculo", () => {
    const follow = Follow.fake().aFollow().build();
    follow.disableNotifications();
    expect(follow.notifications_enabled).toBe(false);
    follow.enableNotifications();
    expect(follow.notifications_enabled).toBe(true);
  });
});
