import { ExecutionContext } from "@nestjs/common";

import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import { EstablishmentOwnershipGuard } from "../ownership/establishment-ownership.guard";
import { MusicianOwnershipGuard } from "../ownership/musician-ownership.guard";

function makeContext(
  params: Record<string, string>,
  currentUser: AuthenticatedUser | undefined,
): ExecutionContext {
  const request = { params, currentUser };
  return {
    getType: () => "http",
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const adminUser: AuthenticatedUser = {
  userId: "admin-uuid",
  roles: ["admin"],
  establishmentIds: [],
  bandIds: [],
  isAdmin: true,
};

const establishmentOwner: AuthenticatedUser = {
  userId: "owner-uuid",
  roles: ["establishment"],
  establishmentIds: ["estab-a-uuid"],
  bandIds: [],
  isAdmin: false,
};

const musicianA: AuthenticatedUser = {
  userId: "musician-a-uuid",
  roles: ["musician"],
  establishmentIds: [],
  bandIds: [],
  isAdmin: false,
};

describe("EstablishmentOwnershipGuard", () => {
  let guard: EstablishmentOwnershipGuard;

  beforeEach(() => {
    guard = new EstablishmentOwnershipGuard();
  });

  it("deve permitir admin operar qualquer estabelecimento", () => {
    const ctx = makeContext({ id: "qualquer-uuid" }, adminUser);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("deve permitir owner operar seu próprio estabelecimento", () => {
    const ctx = makeContext({ id: "estab-a-uuid" }, establishmentOwner);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("deve bloquear owner tentar operar estabelecimento alheio", () => {
    const ctx = makeContext({ id: "estab-b-uuid" }, establishmentOwner);
    expect(() => guard.canActivate(ctx)).toThrow("permissão");
  });

  it("deve retornar true quando não há id no path (rota de coleção)", () => {
    const ctx = makeContext({}, establishmentOwner);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("deve lançar ForbiddenException quando currentUser está ausente", () => {
    const ctx = makeContext({ id: "estab-a-uuid" }, undefined);
    expect(() => guard.canActivate(ctx)).toThrow();
  });
});

describe("MusicianOwnershipGuard", () => {
  let guard: MusicianOwnershipGuard;

  beforeEach(() => {
    guard = new MusicianOwnershipGuard();
  });

  it("deve permitir admin operar qualquer músico", () => {
    const ctx = makeContext({ id: "outro-uuid" }, adminUser);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("deve permitir músico operar seu próprio perfil", () => {
    const ctx = makeContext({ id: "musician-a-uuid" }, musicianA);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("deve bloquear músico A tentar operar perfil do músico B", () => {
    const ctx = makeContext({ id: "musician-b-uuid" }, musicianA);
    expect(() => guard.canActivate(ctx)).toThrow("permissão");
  });

  it("deve retornar true quando não há id no path", () => {
    const ctx = makeContext({}, musicianA);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("deve lançar ForbiddenException quando currentUser está ausente", () => {
    const ctx = makeContext({ id: "musician-a-uuid" }, undefined);
    expect(() => guard.canActivate(ctx)).toThrow();
  });
});
