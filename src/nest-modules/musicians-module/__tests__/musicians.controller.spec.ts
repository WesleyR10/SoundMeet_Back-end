import { MusicianOutput } from "../../../core/musician/application/use-cases/common/musician-profile-output";
import { ListMusiciansOutput } from "../../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";
import { Currency } from "../../../core/shared/domain/value-objects/money.vo";
import { CreateMusicianDto } from "../dto/create-musician.dto";
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
    phone: "+5511999999999",
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

  describe("create", () => {
    it("should create a musician", async () => {
      const output = makeMusicianOutput();
      const mockCreateUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).createUseCase = mockCreateUseCase;

      const serializeSpy = jest.spyOn(MusiciansController, "serialize");
      const input: CreateMusicianDto = {
        name: "John Doe",
        email: "john@example.com",
        phone: "+5511999999999",
        genres: ["Rock"],
        instruments: ["Guitar"],
        experience_years: 0,
        is_active: true,
      } as any;

      const presenter = await controller.create(input);

      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(input);
      expect(serializeSpy).toHaveBeenCalledWith(output);
      expect(presenter).toBeInstanceOf(MusicianPresenter);
      expect(presenter).toStrictEqual(new MusicianPresenter(output));
    });

    it("should throw when create use case throws", async () => {
      const error = new Error("create error");
      const mockCreateUseCase = {
        execute: jest.fn().mockRejectedValue(error),
      };
      (controller as any).createUseCase = mockCreateUseCase;

      const input: CreateMusicianDto = {
        name: "John Doe",
        email: "john@example.com",
        phone: "+5511999999999",
        genres: ["Rock"],
        instruments: ["Guitar"],
      } as any;

      await expect(controller.create(input)).rejects.toThrow(error);
    });
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

      expect(mockGetUseCase.execute).toHaveBeenCalledWith({ id });
      expect(presenter).toBeInstanceOf(PublicMusicianPresenter);
      expect(presenter).not.toHaveProperty("email");
      expect(presenter).not.toHaveProperty("phone");
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
        is_active: true,
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
          experience: 5,
          instruments: ["Guitar"],
          genres: ["Rock"],
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
          experience: 0,
          instruments: [],
          genres: [],
          created_at: new Date("2025-01-01T00:00:00.000Z"),
          updated_at: new Date("2025-01-01T00:00:00.000Z"),
        },
      });

      const mockSetTouringLocationUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).setTouringLocationUseCase = mockSetTouringLocationUseCase;

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
      (controller as any).clearTouringLocationUseCase = mockClearTouringLocationUseCase;

      await controller.clearTouringLocation(id);

      expect(mockClearTouringLocationUseCase.execute).toHaveBeenCalledWith({ id });
    });
  });

  describe("remove", () => {
    it("should delete a musician", async () => {
      const mockDeleteUseCase = {
        execute: jest.fn().mockResolvedValue(undefined),
      };
      (controller as any).deleteUseCase = mockDeleteUseCase;

      const id = "9366b7dc-2d71-4799-b91c-c64adb205104";
      await expect(controller.remove(id)).resolves.toBeUndefined();
      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith({ id });
    });

    it("should throw when delete use case throws", async () => {
      const error = new Error("delete error");
      const mockDeleteUseCase = {
        execute: jest.fn().mockRejectedValue(error),
      };
      (controller as any).deleteUseCase = mockDeleteUseCase;

      const id = "9366b7dc-2d71-4799-b91c-c64adb205104";
      await expect(controller.remove(id)).rejects.toThrow(error);
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
