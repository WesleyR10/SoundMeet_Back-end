import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import { EstablishmentOwnershipGuard } from "../ownership/establishment-ownership.guard";
import { MusicianOwnershipGuard } from "../ownership/musician-ownership.guard";
import { OwnershipParam } from "../ownership/ownership-param.decorator";

// Handler/classe reais para o Reflector ler metadata de @OwnershipParam.
class FakeControllerWithoutMetadata {
  handler() {}
}

class FakeCampaignController {
  @OwnershipParam({ bodyKey: "establishment_id" })
  create() {}
}

function makeContext(
  params: Record<string, string>,
  currentUser: AuthenticatedUser | undefined,
  options?: {
    body?: Record<string, unknown>;
    handler?: (...args: unknown[]) => unknown;
    controllerClass?: new (...args: never[]) => unknown;
  },
): ExecutionContext {
  const request = { params, currentUser, body: options?.body };
  return {
    getType: () => "http",
    getHandler: () =>
      options?.handler ?? FakeControllerWithoutMetadata.prototype.handler,
    getClass: () => options?.controllerClass ?? FakeControllerWithoutMetadata,
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

// Bloco 9.1 — fecha o ciclo do registro de estabelecimento com o guard.
// Aqui está a diferença que mais confunde neste projeto: para músico e público
// o guard funciona porque `aggregate_id == sub`; para estabelecimento o `sub`
// é irrelevante e tudo depende do claim `establishment_ids`, que só entra no
// PRÓXIMO token emitido — daí o `needs_token_refresh` no output do registro.
describe("EstablishmentOwnershipGuard — dono recém-registrado (Bloco 9.1)", () => {
  const NEW_ESTABLISHMENT_ID = "b6a1f0c2-7d34-4e58-9a10-2f3c4d5e6f70";
  const OWNER_SUB = "3f1e2d4c-5b6a-4c7d-8e9f-0a1b2c3d4e5f";

  let guard: EstablishmentOwnershipGuard;

  beforeEach(() => {
    guard = new EstablishmentOwnershipGuard(new Reflector());
  });

  it("bloqueia com o token emitido no ato do registro (claim ainda ausente)", () => {
    const tokenBeforeRefresh: AuthenticatedUser = {
      userId: OWNER_SUB,
      roles: ["establishment"],
      establishmentIds: [],
      bandIds: [],
      isAdmin: false,
    };

    const ctx = makeContext({ id: NEW_ESTABLISHMENT_ID }, tokenBeforeRefresh);
    expect(() => guard.canActivate(ctx)).toThrow("permissão");
  });

  it("permite após o refresh, quando o claim establishment_ids chega no token", () => {
    const tokenAfterRefresh: AuthenticatedUser = {
      userId: OWNER_SUB,
      roles: ["establishment"],
      establishmentIds: [NEW_ESTABLISHMENT_ID],
      bandIds: [],
      isAdmin: false,
    };

    const ctx = makeContext({ id: NEW_ESTABLISHMENT_ID }, tokenAfterRefresh);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // Regressão da armadilha documentada: quem copiar o RegisterUseCase e criar
  // o Establishment com o `sub` como id passa a ter dois donos possíveis e o
  // modelo de posse deixa de fazer sentido. O guard nunca olha o `sub`.
  it("não autoriza pelo sub — mesmo o dono, se o id do agregado fosse o sub", () => {
    const tokenAfterRefresh: AuthenticatedUser = {
      userId: OWNER_SUB,
      roles: ["establishment"],
      establishmentIds: [NEW_ESTABLISHMENT_ID],
      bandIds: [],
      isAdmin: false,
    };

    const ctx = makeContext({ id: OWNER_SUB }, tokenAfterRefresh);
    expect(() => guard.canActivate(ctx)).toThrow("permissão");
  });
});

describe("EstablishmentOwnershipGuard", () => {
  let guard: EstablishmentOwnershipGuard;

  beforeEach(() => {
    guard = new EstablishmentOwnershipGuard(new Reflector());
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

  // Fail-closed: guard aplicado numa rota sem id resolvível é erro de
  // configuração — nega em vez de liberar (antes retornava true).
  it("deve negar quando não há id resolvível no path (fail-closed)", () => {
    const ctx = makeContext({}, establishmentOwner);
    expect(() => guard.canActivate(ctx)).toThrow(
      "Não foi possível determinar o recurso",
    );
  });

  it("deve lançar ForbiddenException quando currentUser está ausente", () => {
    const ctx = makeContext({ id: "estab-a-uuid" }, undefined);
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  // Regressão do POST /campaigns: rota de criação sem :id resolve o dono
  // pelo body via @OwnershipParam({ bodyKey }) — antes o guard liberava e o
  // use case aceitava establishment_id de terceiro.
  describe("@OwnershipParam({ bodyKey }) — rota de criação", () => {
    const withBodyKey = {
      handler: FakeCampaignController.prototype.create,
      controllerClass: FakeCampaignController,
    };

    it("deve permitir criar recurso para o próprio estabelecimento", () => {
      const ctx = makeContext({}, establishmentOwner, {
        ...withBodyKey,
        body: { establishment_id: "estab-a-uuid" },
      });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("deve bloquear criar recurso em nome de outro estabelecimento", () => {
      const ctx = makeContext({}, establishmentOwner, {
        ...withBodyKey,
        body: { establishment_id: "estab-b-uuid" },
      });
      expect(() => guard.canActivate(ctx)).toThrow("permissão");
    });

    it("deve negar quando o body não traz a chave declarada", () => {
      const ctx = makeContext({}, establishmentOwner, {
        ...withBodyKey,
        body: {},
      });
      expect(() => guard.canActivate(ctx)).toThrow(
        "Não foi possível determinar o recurso",
      );
    });
  });
});

describe("MusicianOwnershipGuard", () => {
  let guard: MusicianOwnershipGuard;

  beforeEach(() => {
    guard = new MusicianOwnershipGuard(new Reflector());
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

  it("deve negar quando não há id resolvível no path (fail-closed)", () => {
    const ctx = makeContext({}, musicianA);
    expect(() => guard.canActivate(ctx)).toThrow(
      "Não foi possível determinar o recurso",
    );
  });

  it("deve lançar ForbiddenException quando currentUser está ausente", () => {
    const ctx = makeContext({ id: "musician-a-uuid" }, undefined);
    expect(() => guard.canActivate(ctx)).toThrow();
  });

  // Regressão histórica: rotas aninhadas musicians/:musician_id/repertoires/:x.
  // O guard agora resolve o nome ESPECÍFICO antes de "id", então mesmo uma
  // rota aninhada que use ":id" pra outra entidade resolve o músico certo.
  describe("rotas aninhadas — precedência musician_id > id", () => {
    it("deve permitir músico dono operar seu próprio repertório", () => {
      const ctx = makeContext(
        { musician_id: "musician-a-uuid", repertoire_id: "repertorio-x-uuid" },
        musicianA,
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("deve bloquear músico A tentar operar repertório de outro músico", () => {
      const ctx = makeContext(
        { musician_id: "musician-b-uuid", repertoire_id: "repertorio-x-uuid" },
        musicianA,
      );
      expect(() => guard.canActivate(ctx)).toThrow("permissão");
    });

    it("deve resolver musician_id mesmo quando a rota aninhada ainda usa :id pra outra entidade", () => {
      // Antes do fix no guard, params["id"] tinha precedência e virava o id
      // do sub-recurso → 403 pro dono real. Agora o específico vence.
      const ctx = makeContext(
        { musician_id: "musician-a-uuid", id: "sub-recurso-uuid" },
        musicianA,
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("deve permitir músico dono operar sub-recurso de música dentro do repertório (add/remove/reorder)", () => {
      const ctx = makeContext(
        {
          musician_id: "musician-a-uuid",
          repertoire_id: "repertorio-x-uuid",
          song_id: "song-y-uuid",
        },
        musicianA,
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  /**
   * Bloco 8E — musicians/:musician_id/personal-chord-sheets/:personal_chord_sheet_id
   *
   * A rota mais aninhada do módulo novo (…/edits/:edit_id) tem TRÊS ids no path.
   * Estes testes travam que o guard resolve o MÚSICO e não um dos filhos —
   * a classe de bug que já mordeu o projeto duas vezes.
   */
  describe("rotas aninhadas — cifra pessoal", () => {
    it("deve permitir o dono operar sua cifra pessoal", () => {
      const ctx = makeContext(
        {
          musician_id: "musician-a-uuid",
          personal_chord_sheet_id: "fork-x-uuid",
        },
        musicianA,
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("deve bloquear músico A operando a cifra pessoal de outro músico", () => {
      const ctx = makeContext(
        {
          musician_id: "musician-b-uuid",
          personal_chord_sheet_id: "fork-x-uuid",
        },
        musicianA,
      );
      expect(() => guard.canActivate(ctx)).toThrow("permissão");
    });

    it("deve resolver musician_id na rota de edits, com três ids no path", () => {
      const ctx = makeContext(
        {
          musician_id: "musician-a-uuid",
          personal_chord_sheet_id: "fork-x-uuid",
          edit_id: "edit-y-uuid",
        },
        musicianA,
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("deve honrar @OwnershipParam({ param: musician_id }) da rota", () => {
      class FakePersonalChordSheetController {
        @OwnershipParam({ param: "musician_id" })
        applyEdits() {}
      }

      const ctx = makeContext(
        {
          musician_id: "musician-a-uuid",
          personal_chord_sheet_id: "fork-x-uuid",
        },
        musicianA,
        {
          handler: FakePersonalChordSheetController.prototype.applyEdits,
          controllerClass: FakePersonalChordSheetController,
        },
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
