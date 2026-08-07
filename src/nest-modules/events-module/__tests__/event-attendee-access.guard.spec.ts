import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { AuthenticatedUser } from "../../auth-module/interfaces/authenticated-user.interface";
import { EventAttendeeAccessGuard } from "../guards/event-attendee-access.guard";

const OWN_ESTABLISHMENT = "11111111-1111-4111-8111-111111111111";
const OTHER_ESTABLISHMENT = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";

function makeContext(
  currentUser: Partial<AuthenticatedUser> | undefined,
  establishmentIdInRoute: string,
) {
  const request = {
    params: { id: establishmentIdInRoute, event_id: EVENT_ID },
    currentUser,
  };
  return {
    getType: () => "http",
    switchToHttp: () => ({ getRequest: () => request }),
    // Reflector lê metadata do handler/class — precisam ser alvos reais.
    getHandler: () => function addAttendee() {},
    getClass: () => class EventsControllerStub {},
  } as never;
}

const user = (
  over: Partial<AuthenticatedUser> = {},
): Partial<AuthenticatedUser> => ({
  userId: "99999999-9999-4999-8999-999999999999",
  roles: ["establishment"],
  establishmentIds: [OWN_ESTABLISHMENT],
  bandIds: [],
  isAdmin: false,
  ...over,
});

describe("EventAttendeeAccessGuard", () => {
  let guard: EventAttendeeAccessGuard;

  beforeEach(() => {
    guard = new EventAttendeeAccessGuard(new Reflector());
  });

  it("permite establishment no próprio evento", () => {
    expect(guard.canActivate(makeContext(user(), OWN_ESTABLISHMENT))).toBe(
      true,
    );
  });

  it("bloqueia establishment em evento de outro estabelecimento", () => {
    expect(() =>
      guard.canActivate(makeContext(user(), OTHER_ESTABLISHMENT)),
    ).toThrow(ForbiddenException);
  });

  it("permite audience — o controller força o audience_id do próprio JWT", () => {
    const audience = user({ roles: ["audience"], establishmentIds: [] });
    expect(guard.canActivate(makeContext(audience, OTHER_ESTABLISHMENT))).toBe(
      true,
    );
  });

  it("permite admin em qualquer estabelecimento", () => {
    const admin = user({
      roles: ["admin"],
      establishmentIds: [],
      isAdmin: true,
    });
    expect(guard.canActivate(makeContext(admin, OTHER_ESTABLISHMENT))).toBe(
      true,
    );
  });

  it("bloqueia requisição sem contexto de usuário", () => {
    expect(() =>
      guard.canActivate(makeContext(undefined, OWN_ESTABLISHMENT)),
    ).toThrow(ForbiddenException);
  });

  it("não deixa músico operar presença de estabelecimento alheio", () => {
    const musician = user({ roles: ["musician"], establishmentIds: [] });
    expect(() =>
      guard.canActivate(makeContext(musician, OTHER_ESTABLISHMENT)),
    ).toThrow(ForbiddenException);
  });
});
