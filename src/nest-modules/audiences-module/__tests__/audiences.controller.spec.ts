import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";

import { AudienceOutput } from "../../../core/audience/application/use-cases/common/audience-output";
import { ListAudiencesOutput } from "../../../core/audience/application/use-cases/list-audiences/list-audiences.use-case";
import { SortDirection } from "../../../core/shared/domain/repository/search-params";
import { IS_PUBLIC_KEY } from "../../auth-module/auth.decorators";
import {
  AudienceCollectionPresenter,
  AudiencePresenter,
  MakeMusicRequestPresenter,
  ScanQRPresenter,
  SendTipPresenter,
} from "../audience.presenter";
import { AudiencesController } from "../audiences.controller";
import { SearchAudiencesDto } from "../dto/search-audiences.dto";
import { UpdateAudienceDto } from "../dto/update-audience.dto";

function makeAudienceOutput(
  overrides: Partial<AudienceOutput> = {},
): AudienceOutput {
  const now = new Date();

  return {
    id: "9366b7dc-2d71-4799-b91c-c64adb205104",
    email: "user@example.com",
    name: "User",
    nickname: null,
    avatar: null,
    phone: null,
    points: {
      total: 0,
      monthly: 0,
      last_updated: now,
    },
    level: {
      level: 1,
      name: "Novato",
      min_points: 0,
      max_points: 99,
      benefits: ["Acesso básico"],
    },
    preferences: {
      favorite_genres: [],
      favorite_artists: [],
      favorite_instruments: [],
      preferred_languages: ["pt-BR"],
      notification_settings: {},
      privacy_settings: {},
      music_discovery_settings: {},
    },
    notification_settings: {},
    privacy_settings: {},
    discovery_settings: {},
    is_active: true,
    created_at: now,
    updated_at: now,
    display_name: "User",
    current_level: 1,
    level_name: "Novato",
    points_to_next_level: 100,
    max_requests_per_event: 5,
    has_vip_access: false,
    can_access_exclusive_content: false,
    is_profile_complete: false,
    is_highly_engaged: false,
    is_new_user: true,
    ...overrides,
  };
}

describe("AudiencesController Unit Tests", () => {
  let controller: AudiencesController;

  beforeEach(async () => {
    jest.restoreAllMocks();
    controller = new AudiencesController();
  });

  /*
   * SM-021 — regressão: a criação de público não pode voltar por HTTP.
   *
   * A varredura é por metadata do Nest, e não por `controller.create`, porque
   * o risco real não é alguém restaurar o método com o mesmo nome — é alguém
   * adicionar um `@Post()` novo, com outro nome, sem lembrar por que ele não
   * existia. E nenhuma rota deste controller pode ser `@Public()`: perfil de
   * público nasce no registro, com o `sub` do Keycloak, ou não nasce.
   */
  describe("SM-021 — superfície pública", () => {
    const routes = () =>
      Object.getOwnPropertyNames(AudiencesController.prototype)
        .filter((name) => name !== "constructor")
        .map((name) => {
          const handler = (AudiencesController.prototype as any)[name];
          return {
            name,
            path: Reflect.getMetadata(PATH_METADATA, handler),
            method: Reflect.getMetadata(METHOD_METADATA, handler),
            isPublic: Reflect.getMetadata(IS_PUBLIC_KEY, handler),
          };
        })
        .filter((r) => r.method !== undefined);

    it("não expõe POST na raiz do recurso", () => {
      const rootPosts = routes().filter(
        (r) =>
          r.method === RequestMethod.POST && (r.path === "/" || r.path === ""),
      );
      expect(rootPosts).toEqual([]);
    });

    it("não tem nenhuma rota @Public()", () => {
      expect(routes().filter((r) => r.isPublic)).toEqual([]);
    });
  });

  describe("findAll", () => {
    it("should list audiences", async () => {
      const output: ListAudiencesOutput = {
        items: [makeAudienceOutput()],
        current_page: 1,
        last_page: 1,
        per_page: 2,
        total: 1,
      };
      const mockListUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).listUseCase = mockListUseCase;

      const query: SearchAudiencesDto = {
        page: 1,
        per_page: 2,
        sort: "name",
        sort_dir: "desc" as SortDirection,
        filter: { name: "User" },
      };

      const presenter = await controller.findAll(query);

      expect(mockListUseCase.execute).toHaveBeenCalledWith(query);
      expect(presenter).toBeInstanceOf(AudienceCollectionPresenter);
      expect(presenter).toEqual(new AudienceCollectionPresenter(output));
    });
  });

  describe("update", () => {
    it("should update an audience", async () => {
      const id = "9366b7dc-2d71-4799-b91c-c64adb205104";
      const output = makeAudienceOutput({ id, name: "Updated User" });
      const mockUpdateUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).updateUseCase = mockUpdateUseCase;

      const serializeSpy = jest.spyOn(AudiencesController, "serialize");
      const input: UpdateAudienceDto = {
        name: "Updated User",
        is_active: false,
      } as any;

      const presenter = await controller.update(id, input);

      expect(mockUpdateUseCase.execute).toHaveBeenCalledWith({ id, ...input });
      expect(serializeSpy).toHaveBeenCalledWith(output);
      expect(presenter).toBeInstanceOf(AudiencePresenter);
      expect(presenter).toStrictEqual(new AudiencePresenter(output));
    });
  });

  describe("scanQR", () => {
    it("should scan qr code", async () => {
      const id = "9366b7dc-2d71-4799-b91c-c64adb205104";
      const output = {
        audience: makeAudienceOutput({ id }),
        points_earned: { toJSON: () => ({ value: 10, source: "scan_qr" }) },
        new_badges: [],
        new_level: undefined,
        scan_metadata: {
          qr_code: "qr_code",
          scanned_at: new Date(),
        },
      };
      const mockUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).scanQRUseCase = mockUseCase;

      const presenter = await controller.scanQR(id, {
        qr_code: "qr_code",
      } as any);

      expect(mockUseCase.execute).toHaveBeenCalledWith({
        id,
        qr_code: "qr_code",
      });
      expect(presenter).toBeInstanceOf(ScanQRPresenter);
    });
  });

  describe("makeMusicRequest", () => {
    it("should make music request", async () => {
      const id = "9366b7dc-2d71-4799-b91c-c64adb205104";
      const event_id = "2b6b6a32-8f4a-4d4c-b2e4-4f8e99c8b89d";
      const output = {
        audience: makeAudienceOutput({ id }),
        points_earned: 25,
        new_badges: [],
        new_level: 1,
        request_metadata: {
          musician_id: "musician_id",
          song_title: "Song",
          artist_name: "Artist",
          event_id,
          requested_at: new Date(),
          status: "pending",
        },
      };
      const mockUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).makeMusicRequestUseCase = mockUseCase;

      const presenter = await controller.makeMusicRequest(id, {
        musician_id: "musician_id",
        song_title: "Song",
        artist_name: "Artist",
        event_id,
      } as any);

      expect(mockUseCase.execute).toHaveBeenCalledWith({
        id,
        musician_id: "musician_id",
        song_title: "Song",
        artist_name: "Artist",
        event_id,
      });
      expect(presenter).toBeInstanceOf(MakeMusicRequestPresenter);
    });
  });

  describe("sendTip", () => {
    it("should send tip", async () => {
      const id = "9366b7dc-2d71-4799-b91c-c64adb205104";
      const output = {
        audience: makeAudienceOutput({ id }),
        points_earned: 10,
        new_badges: [],
        new_level: undefined,
        tip_metadata: {
          musician_id: "musician_id",
          amount: 10,
          payment_method: "pix",
          sent_at: new Date(),
          status: "success",
        },
      };
      const mockUseCase = {
        execute: jest.fn().mockResolvedValue(output),
      };
      (controller as any).sendTipUseCase = mockUseCase;

      const presenter = await controller.sendTip(id, {
        musician_id: "musician_id",
        amount: 10,
        payment_method: "pix",
      } as any);

      expect(mockUseCase.execute).toHaveBeenCalledWith({
        id,
        musician_id: "musician_id",
        amount: 10,
        payment_method: "pix",
      });
      expect(presenter).toBeInstanceOf(SendTipPresenter);
    });
  });
});
