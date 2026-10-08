import { UnauthorizedException } from "@nestjs/common";

import { MusicianOutput } from "../../../core/musician/application/use-cases/common/musician-profile-output";
import { ListMusiciansOutput } from "../../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";
import { Currency } from "../../../core/shared/domain/value-objects/money.vo";
import { SearchMusiciansDto } from "../dto/search-musicians.dto";
import { UpdateMusicianDto } from "../dto/update-musician.dto";
import { UpdateMusicianProfileDto } from "../dto/update-musician-profile.dto";
import {
  MusicianCollectionPresenter,
  MusicianPresenter,
  PublicMusicianPresenter,
} from "../musician.presenter";
import { MusiciansController } from "../musicians.controller";

function makeMusicianOutput(
  overrides: Partial<MusicianOutput> = {},
): MusicianOutput {
  const now = new Date("2025-01-01T00:00:00.000Z");
  return {
    id: "9366b7dc-2d71-4799-b91c-c64adb205104",
    email: "john@example.com",
    name: "John Doe",
    stage_name: null,
    bio: null,
    avatar: null,
    presentation_audio: null,
    phone: "+5511999999999",
    cnpj: null,
    genres: ["Rock"],
    instruments: ["Guitar"],
    experience_years: 0,
    qr_code: "qr-code-value",
    qr_customization: null,
    rating: 0,
    total_ratings: 0,
    is_active: true,
    is_verified: false,
    open_to_gigs: null,
    accepts_requests_outside_repertoire: true,
    profile: null,
    created_at: now,
    updated_at: now,
    display_name: "John Doe",
    is_experienced: false,
    is_highly_rated: false,
    ...overrides,
  };
}

describe("MusiciansController Unit Tests", () => {
  let controller: MusiciansController;

  beforeEach(async () => {
    jest.restoreAllMocks();
    controller = new MusiciansController();
  });

  describe("findAll", () => {
    it("should list musicians", async () => {
      const output: ListMusiciansOutput = {
        items: [makeMusicianOutput()],
        current_page: 1,
        last_page: 1,
        per_page: 2,
        total: 1,
      };
      const mockListUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).listUseCase = mockListUseCase;

      const serializeSpy = jest.spyOn(MusiciansController, "serialize");
      const query: SearchMusiciansDto = {
        page: 1,
        per_page: 2,
        sort: "name",
        sort_dir: "desc" as SortDirection,
        filter: { name: "John" },
      };

      const presenter = await controller.findAll(query);

      expect(mockListUseCase.execute).toHaveBeenCalledWith(query);
      expect(serializeSpy).not.toHaveBeenCalled();
      expect(presenter).toBeInstanceOf(MusicianCollectionPresenter);
      expect(presenter).toEqual(new MusicianCollectionPresenter(output));
    });

    it("should throw when list use case throws", async () => {
      const error = new Error("list error");
      const mockListUseCase = {
        execute: jest.fn().mockRejectedValue(error),
      };
      (controller as any).listUseCase = mockListUseCase;

      const query: SearchMusiciansDto = {
        page: 1,
        per_page: 2,
      };

      await expect(controller.findAll(query)).rejects.toThrow(error);
    });
  });

  describe("findOne", () => {
    const id = "9366b7dc-2d71-4799-b91c-c64adb205104";
    const strangerUser = {
      userId: "other-uuid",
      roles: ["musician"],
      establishmentIds: [],
      bandIds: [],
      isAdmin: false,
    };
    const adminUser = {
      userId: "admin-uuid",
      roles: ["admin"],
      establishmentIds: [],
      bandIds: [],
      isAdmin: true,
    };

    // Rota @Public() com soft-auth (AuthGuard) — currentUser vem undefined
    // (anônimo), de um estranho autenticado, do próprio dono, ou de admin.
    // Só dono/admin recebem email/phone; os outros dois casos recebem a
    // versão pública (sem PII) pela MESMA rota.
    it("anônimo (sem currentUser) recebe PublicMusicianPresenter, sem email/phone", async () => {
      const output = makeMusicianOutput({ id });
      const mockGetUseCase = { execute: jest.fn().mockResolvedValue(output) };
      (controller as any).getUseCase = mockGetUseCase;

      const presenter = await controller.findOne(id);

      // Terceiro não lê `plan_tier`, então a consulta de assinatura é pulada.
      expect(mockGetUseCase.execute).toHaveBeenCalledWith({
        id,
        include_plan_tier: false,
      });
      expect(presenter).toBeInstanceOf(PublicMusicianPresenter);
      expect(presenter).not.toHaveProperty("email");
      expect(presenter).not.toHaveProperty("phone");
      expect(presenter).not.toHaveProperty("plan_tier");
    });

    it("estranho autenticado (outro musician_id) recebe PublicMusicianPresenter", async () => {
      const output = makeMusicianOutput({ id });
      const mockGetUseCase = { execute: jest.fn().mockResolvedValue(output) };
      (controller as any).getUseCase = mockGetUseCase;

      const presenter = await controller.findOne(id, strangerUser as any);

      expect(presenter).toBeInstanceOf(PublicMusicianPresenter);
      expect(presenter).not.toHaveProperty("email");
    });

    it("o próprio dono recebe MusicianPresenter completo, com email/phone", async () => {
      const output = makeMusicianOutput({ id });
      const mockGetUseCase = { execute: jest.fn().mockResolvedValue(output) };
      (controller as any).getUseCase = mockGetUseCase;
      const serializeSpy = jest.spyOn(MusiciansController, "serialize");
      const ownerUser = { ...strangerUser, userId: id };

      const presenter = await controller.findOne(id, ownerUser as any);

      expect(mockGetUseCase.execute).toHaveBeenCalledWith({
        id,
        include_plan_tier: true,
      });
      expect(serializeSpy).toHaveBeenCalledWith(output);
      expect(presenter).toBeInstanceOf(MusicianPresenter);
      expect(presenter).toStrictEqual(new MusicianPresenter(output));
    });

    it("admin recebe MusicianPresenter completo mesmo vendo o perfil de outro músico", async () => {
      const output = makeMusicianOutput({ id });
      const mockGetUseCase = { execute: jest.fn().mockResolvedValue(output) };
      (controller as any).getUseCase = mockGetUseCase;

      const presenter = await controller.findOne(id, adminUser as any);

      expect(presenter).toBeInstanceOf(MusicianPresenter);
      expect((presenter as MusicianPresenter).email).toBe(output.email);
    });

    it("should throw when get use case throws", async () => {
      const error = new Error("get error");
      const mockGetUseCase = {
        execute: jest.fn().mockRejectedValue(error),
      };
      (controller as any).getUseCase = mockGetUseCase;

      await expect(controller.findOne(id)).rejects.toThrow(error);
    });

    /*
     * 🔴 O dono com token expirado.
     *
     * A rota é pública com autenticação opcional: token recusado vira anônimo
     * e a resposta era 200 com a versão PÚBLICA. O app só renova a sessão ao
     * receber 401, então o músico via o próprio perfil sem e-mail, telefone e
     * CNPJ — e salvar o formulário de identidade gravava `cnpj: null`.
     */
    describe("token recusado", () => {
      it("do PRÓPRIO dono responde 401, sem consultar o músico", async () => {
        const mockGetUseCase = { execute: jest.fn() };
        (controller as any).getUseCase = mockGetUseCase;

        await expect(controller.findOne(id, undefined, id)).rejects.toThrow(
          UnauthorizedException,
        );
        expect(mockGetUseCase.execute).not.toHaveBeenCalled();
      });

      it("de OUTRA pessoa segue recebendo a versão pública", async () => {
        const output = makeMusicianOutput({ id });
        const mockGetUseCase = { execute: jest.fn().mockResolvedValue(output) };
        (controller as any).getUseCase = mockGetUseCase;

        const presenter = await controller.findOne(
          id,
          undefined,
          "11111111-2222-4333-8444-555555555555",
        );

        expect(presenter).toBeInstanceOf(PublicMusicianPresenter);
      });

      it("não vira atalho: um token VÁLIDO de terceiro com o mesmo sub recusado não importa", async () => {
        // `currentUser` presente significa que o token passou na verificação;
        // o `sub` recusado nem deveria existir, mas se existir não manda.
        const output = makeMusicianOutput({ id });
        const mockGetUseCase = { execute: jest.fn().mockResolvedValue(output) };
        (controller as any).getUseCase = mockGetUseCase;

        const presenter = await controller.findOne(id, strangerUser as any, id);

        expect(presenter).toBeInstanceOf(PublicMusicianPresenter);
      });
    });
  });

  describe("update", () => {
    it("should update a musician", async () => {
      const id = "9366b7dc-2d71-4799-b91c-c64adb205104";
      const output = makeMusicianOutput({
        id,
        name: "Jane Smith",
        email: "jane@example.com",
        display_name: "Jane Smith",
      });
      const mockUpdateUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).updateUseCase = mockUpdateUseCase;

      const serializeSpy = jest.spyOn(MusiciansController, "serialize");
      const input: UpdateMusicianDto = {
        name: "Jane Smith",
        email: "jane@example.com",
      } as any;

      const presenter = await controller.update(id, input);

      expect(mockUpdateUseCase.execute).toHaveBeenCalledWith({ id, ...input });
      expect(serializeSpy).toHaveBeenCalledWith(output);
      expect(presenter).toBeInstanceOf(MusicianPresenter);
      expect(presenter).toStrictEqual(new MusicianPresenter(output));
    });

    it("should throw when update use case throws", async () => {
      const error = new Error("update error");
      const mockUpdateUseCase = {
        execute: jest.fn().mockRejectedValue(error),
      };
      (controller as any).updateUseCase = mockUpdateUseCase;

      const id = "9366b7dc-2d71-4799-b91c-c64adb205104";
      const input: UpdateMusicianDto = {
        name: "Jane Smith",
      } as any;

      await expect(controller.update(id, input)).rejects.toThrow(error);
    });
  });

  describe("updateProfile", () => {
    it("should update musician profile", async () => {
      const id = "9366b7dc-2d71-4799-b91c-c64adb205104";
      const output = makeMusicianOutput({
        id,
        profile: {
          id: "3c8e2e5b-9e76-4dbd-8ee4-5d6f1b53ac01",
          musician_id: id,
          price_ranges: [
            {
              model: "per_hour",
              min: 100,
              max: 200,
              currency: "BRL" as Currency,
              notes: null,
            },
          ],
          location: {
            city: "São Paulo",
            state: "SP",
            latitude: null,
            longitude: null,
            street: null,
            number: null,
            complement: null,
            neighborhood: null,
            zip_code: null,
          },
          touring_location: null,
          touring_expires_at: null,
          is_touring: false,
          social_links: { instagram: "@john" },
          created_at: new Date("2025-01-01T00:00:00.000Z"),
          updated_at: new Date("2025-01-01T00:00:00.000Z"),
        },
      });

      const mockUpdateProfileUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).updateProfileUseCase = mockUpdateProfileUseCase;

      const serializeSpy = jest.spyOn(MusiciansController, "serialize");
      const input: UpdateMusicianProfileDto = {
        experience: 5,
        socialLinks: { instagram: "@john" },
        priceRange: {
          model: "per_hour",
          min: 100,
          max: 200,
          currency: Currency.BRL,
          notes: null,
        },
      } as any;

      const presenter = await controller.updateProfile(id, input);

      expect(mockUpdateProfileUseCase.execute).toHaveBeenCalledWith({
        id,
        ...input,
      });
      expect(serializeSpy).toHaveBeenCalledWith(output);
      expect(presenter).toBeInstanceOf(MusicianPresenter);
      expect(presenter).toStrictEqual(new MusicianPresenter(output));
    });
  });

  describe("setTouringLocation", () => {
    it("should activate touring mode", async () => {
      const id = "9366b7dc-2d71-4799-b91c-c64adb205104";
      const output = makeMusicianOutput({
        id,
        profile: {
          id: "3c8e2e5b-9e76-4dbd-8ee4-5d6f1b53ac01",
          musician_id: id,
          price_ranges: [],
          location: {
            city: "São Paulo",
            state: "SP",
            latitude: null,
            longitude: null,
            street: null,
            number: null,
            complement: null,
            neighborhood: null,
            zip_code: null,
          },
          touring_location: {
            city: "Recife",
            state: "PE",
            latitude: -8.0476,
            longitude: -34.877,
            street: null,
            number: null,
            complement: null,
            neighborhood: null,
            zip_code: null,
          },
          touring_expires_at: new Date("2025-01-06T00:00:00.000Z"),
          is_touring: true,
          social_links: null,
          created_at: new Date("2025-01-01T00:00:00.000Z"),
          updated_at: new Date("2025-01-01T00:00:00.000Z"),
        },
      });

      const mockSetTouringLocationUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).setTouringLocationUseCase =
        mockSetTouringLocationUseCase;

      const serializeSpy = jest.spyOn(MusiciansController, "serialize");
      const input = {
        city: "Recife",
        state: "PE",
        latitude: -8.0476,
        longitude: -34.877,
        duration_days: 5,
      } as any;

      const presenter = await controller.setTouringLocation(id, input);

      expect(mockSetTouringLocationUseCase.execute).toHaveBeenCalledWith({
        id,
        ...input,
      });
      expect(serializeSpy).toHaveBeenCalledWith(output);
      expect(presenter).toBeInstanceOf(MusicianPresenter);
      expect(presenter.profile?.is_touring).toBe(true);
    });
  });

  describe("clearTouringLocation", () => {
    it("should clear touring mode", async () => {
      const id = "9366b7dc-2d71-4799-b91c-c64adb205104";
      const mockClearTouringLocationUseCase = {
        execute: jest.fn().mockResolvedValue(makeMusicianOutput({ id })),
      };
      (controller as any).clearTouringLocationUseCase =
        mockClearTouringLocationUseCase;

      await controller.clearTouringLocation(id);

      expect(mockClearTouringLocationUseCase.execute).toHaveBeenCalledWith({
        id,
      });
    });
  });

  describe("serialize", () => {
    it("should serialize output into presenter", () => {
      const output = makeMusicianOutput();
      const presenter = MusiciansController.serialize(output);
      expect(presenter).toBeInstanceOf(MusicianPresenter);
      expect(presenter).toStrictEqual(new MusicianPresenter(output));
    });
  });
});

/**
 * 🔴 Ordem de rota dentro do controller.
 *
 * O Nest casa as rotas na ordem em que os métodos foram declarados. `featured`
 * é um segmento literal e `:id` é curinga: declarado depois, `GET
 * /musicians/featured` casaria como `findOne` com `id="featured"`, o
 * `ParseUUIDPipe` responderia **422** e a faixa "Em destaque" da grade de
 * artistas deixaria de existir — sem erro de compilação, sem teste vermelho e
 * com o handler `findFeatured` correto logo abaixo, o que torna o defeito
 * especialmente difícil de ver numa revisão.
 *
 * Precedente do repo: `@Get("live")` em `PerformanceController`, que casou
 * como `:performance_id` e matou a tela do fã em silêncio.
 */
describe("MusiciansController — ordem de rota", () => {
  const methodOrder = () => {
    const proto = MusiciansController.prototype as unknown as Record<
      string,
      unknown
    >;
    return Object.getOwnPropertyNames(proto).filter(
      (name) => typeof proto[name] === "function" && name !== "constructor",
    );
  };

  const pathOf = (method: string) =>
    Reflect.getMetadata(
      "path",
      (MusiciansController.prototype as unknown as Record<string, any>)[method],
    ) as string | undefined;

  it("declara findIdentities ANTES de findOne", () => {
    const order = methodOrder();

    expect(order.indexOf("findIdentities")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("findIdentities")).toBeLessThan(
      order.indexOf("findOne"),
    );
    expect(pathOf("findIdentities")).toBe("identities");
  });

  it("declara findFeatured ANTES de findOne", () => {
    const order = methodOrder();
    const featuredIndex = order.indexOf("findFeatured");
    const findOneIndex = order.indexOf("findOne");

    expect(featuredIndex).toBeGreaterThanOrEqual(0);
    expect(findOneIndex).toBeGreaterThanOrEqual(0);
    expect(featuredIndex).toBeLessThan(findOneIndex);
  });

  it("os dois handlers continuam nos caminhos que este teste assume", () => {
    // Sem isto, renomear `featured` para outro literal deixaria o teste acima
    // verde enquanto o defeito voltava por outra porta.
    expect(pathOf("findFeatured")).toBe("featured");
    expect(pathOf("findOne")).toBe(":id");
  });

  it("nenhum segmento literal de GET nasce depois de :id", () => {
    /*
     * A regra geral, não só o caso conhecido: qualquer `@Get("algo")` literal
     * declarado depois de `@Get(":id")` é inalcançável. É o guarda para a
     * PRÓXIMA rota, que é o risco real — ninguém vai reintroduzir este bug no
     * `featured`, vão introduzi-lo num handler que ainda não existe.
     */
    const order = methodOrder();
    const idIndex = order.indexOf("findOne");

    const literalGetsAfterId = order.slice(idIndex + 1).filter((method) => {
      const handler = (
        MusiciansController.prototype as unknown as Record<string, any>
      )[method];
      const verb = Reflect.getMetadata("method", handler);
      const path = Reflect.getMetadata("path", handler) as string | undefined;
      /*
       * 0 === RequestMethod.GET no enum do Nest.
       *
       * A raiz da coleção (`"/"`, que é o que `@Get()` registra) fica FORA:
       * `GET /musicians` tem um segmento a menos que `GET /musicians/:id` e
       * não pode ser sombreada por ele. Sem esta exceção o teste acusaria
       * `findAll` se alguém o movesse para baixo, e um teste que grita sem
       * motivo é um teste que alguém apaga.
       */
      const isCollectionRoot =
        path === "/" || path === "" || path === undefined;
      return verb === 0 && !isCollectionRoot && !path!.includes(":");
    });

    expect(literalGetsAfterId).toEqual([]);
  });
});

/**
 * 🔴 Duas rotas que NÃO podem voltar a existir.
 *
 * O risco real não é alguém restaurar o método com o mesmo nome: é nascer um
 * `@Post()` ou um `@Delete(":id")` novo, de quem não sabe por que eles não
 * existiam. Por isso o teste varre a metadata do Nest, e não nomes de método.
 */
describe("MusiciansController — rotas removidas de propósito", () => {
  const handlers = () => {
    const proto = MusiciansController.prototype as unknown as Record<
      string,
      any
    >;
    return Object.getOwnPropertyNames(proto)
      .filter(
        (name) => typeof proto[name] === "function" && name !== "constructor",
      )
      .map((name) => ({
        name,
        // RequestMethod do Nest: 0 GET, 1 POST, 2 PUT, 3 DELETE, 4 PATCH.
        verb: Reflect.getMetadata("method", proto[name]) as number | undefined,
        path: Reflect.getMetadata("path", proto[name]) as string | undefined,
      }))
      .filter((route) => route.verb !== undefined);
  };

  const isRoot = (path?: string) =>
    path === "/" || path === "" || path === undefined;

  it("não há POST na raiz: músico só nasce pelo registro, com o sub do Keycloak", () => {
    const rootPosts = handlers().filter(
      (route) => route.verb === 1 && isRoot(route.path),
    );

    expect(rootPosts.map((route) => route.name)).toEqual([]);
  });

  it("não há DELETE de `:id`: excluir conta não é um repository.delete", () => {
    const deletesOfAggregate = handlers().filter(
      (route) => route.verb === 3 && route.path === ":id",
    );

    expect(deletesOfAggregate.map((route) => route.name)).toEqual([]);
  });

  it("as rotas de sub-recurso continuam de pé (o guarda acima não é um corta-tudo)", () => {
    const deletes = handlers()
      .filter((route) => route.verb === 3)
      .map((route) => route.path)
      .sort();

    expect(deletes).toEqual([
      ":id/presentation-audio",
      ":id/push-token",
      ":id/touring-location",
    ]);
  });
});

describe("MusiciansController — token de push", () => {
  it("registrar responde sem corpo (204): o app chama a cada abertura e descarta a resposta", async () => {
    const controller = new MusiciansController();
    const execute = jest.fn().mockResolvedValue({ id: "x" });
    (controller as any).registerPushTokenUseCase = { execute };
    const id = "9366b7dc-2d71-4799-b91c-c64adb205104";

    const response = await controller.registerPushToken(id, {
      push_token: "ExponentPushToken[abc]",
      push_token_platform: "android",
    } as any);

    expect(response).toBeUndefined();
    expect(execute).toHaveBeenCalledWith({
      id,
      push_token: "ExponentPushToken[abc]",
      push_token_platform: "android",
    });
    expect(
      Reflect.getMetadata(
        "__httpCode__",
        MusiciansController.prototype.registerPushToken,
      ),
    ).toBe(204);
  });

  it("apagar delega ao use-case e responde 204", async () => {
    const controller = new MusiciansController();
    const execute = jest.fn().mockResolvedValue(undefined);
    (controller as any).clearPushTokenUseCase = { execute };
    const id = "9366b7dc-2d71-4799-b91c-c64adb205104";

    await expect(controller.clearPushToken(id)).resolves.toBeUndefined();

    expect(execute).toHaveBeenCalledWith({ id });
    expect(
      Reflect.getMetadata(
        "__httpCode__",
        MusiciansController.prototype.clearPushToken,
      ),
    ).toBe(204);
  });
});

describe("MusiciansController — status documentado é o status respondido", () => {
  // `@Post` responde 201 por padrão; `verify` e `customize` não criam recurso
  // e o Swagger sempre os documentou como 200.
  it.each(["verify", "customizeQRCode"] as const)(
    "%s responde 200",
    (method) => {
      expect(
        Reflect.getMetadata(
          "__httpCode__",
          MusiciansController.prototype[method],
        ),
      ).toBe(200);
    },
  );
});

/*
 * 🔴 O Multer não decide formato de imagem pelo `Content-Type` DECLARADO.
 *
 * Avatar e logo do QR tinham um `fileFilter` que lançava `new Error(...)`
 * quando o tipo declarado não era JPEG/PNG/WEBP. O Nest só traduz os erros
 * que o próprio Multer conhece (`transformException`), então aquele `Error`
 * cru chegava ao filtro global e virava 500 + Sentry por causa de um arquivo
 * errado. E era redundante: o `assertFileSignature` do handler lê os BYTES e
 * responde 422. O áudio de apresentação já era assim.
 */
describe("MusiciansController — uploads de imagem não filtram pelo tipo declarado", () => {
  const multerOf = (
    method: "uploadAvatar" | "uploadQrLogo" | "uploadPresentationAudio",
  ) => {
    const [Interceptor] = Reflect.getMetadata(
      "__interceptors__",
      MusiciansController.prototype[method],
    ) as (new () => {
      multer: {
        fileFilter: (
          req: unknown,
          file: { mimetype: string; originalname: string },
          cb: (error: Error | null, accept: boolean) => void,
        ) => void;
        limits?: { fileSize?: number };
      };
    })[];
    return new Interceptor().multer;
  };

  it.each(["uploadAvatar", "uploadQrLogo", "uploadPresentationAudio"] as const)(
    "%s aceita o arquivo no Multer mesmo com tipo declarado estranho",
    (method) => {
      const callback = jest.fn();

      multerOf(method).fileFilter(
        {},
        { mimetype: "application/octet-stream", originalname: "foto.heic" },
        callback,
      );

      expect(callback).toHaveBeenCalledWith(null, true);
    },
  );

  it("os tetos de tamanho continuam valendo", () => {
    expect(multerOf("uploadAvatar").limits?.fileSize).toBe(5 * 1024 * 1024);
    expect(multerOf("uploadQrLogo").limits?.fileSize).toBe(2 * 1024 * 1024);
  });

  it("avatar e logo do QR têm limite próprio de envios, como o áudio", () => {
    for (const method of [
      "uploadAvatar",
      "uploadQrLogo",
      "uploadPresentationAudio",
    ] as const) {
      const handler = MusiciansController.prototype[method];
      expect(Reflect.getMetadata("THROTTLER:LIMITdefault", handler)).toBe(5);
      expect(Reflect.getMetadata("THROTTLER:TTLdefault", handler)).toBe(60000);
    }
  });
});

describe("MusiciansController — identidades em lote", () => {
  it("delega os ids ao use-case e devolve só a identidade", async () => {
    const controller = new MusiciansController();
    const items = [
      {
        id: "9366b7dc-2d71-4799-b91c-c64adb205104",
        display_name: "Carlão do Piano",
        avatar: null,
        instruments: ["Piano"],
        genres: ["Jazz"],
        rating: 4.8,
        total_ratings: 27,
        is_verified: true,
      },
    ];
    const execute = jest.fn().mockResolvedValue({ items });
    (controller as any).listIdentitiesUseCase = { execute };

    const presenters = await controller.findIdentities({
      ids: ["9366b7dc-2d71-4799-b91c-c64adb205104"],
    });

    expect(execute).toHaveBeenCalledWith({
      ids: ["9366b7dc-2d71-4799-b91c-c64adb205104"],
    });
    expect(presenters.map((presenter) => ({ ...presenter }))).toStrictEqual(
      items,
    );
  });
});
