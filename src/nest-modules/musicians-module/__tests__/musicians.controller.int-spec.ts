import { Test, TestingModule } from "@nestjs/testing";

import { IMusicianStorage } from "../../../core/musician/application/ports/musician-storage.interface";
import { ClearMusicianTouringLocationUseCase } from "../../../core/musician/application/use-cases/clear-musician-touring-location/clear-musician-touring-location.use-case";
import { ClearPushTokenUseCase } from "../../../core/musician/application/use-cases/clear-push-token/clear-push-token.use-case";
import { MusicianOutputMapper } from "../../../core/musician/application/use-cases/common/musician-profile-output";
import { CustomizeQRCodeUseCase } from "../../../core/musician/application/use-cases/customize-qr-code/customize-qr-code.use-case";
import { DeleteMusicianPresentationAudioUseCase } from "../../../core/musician/application/use-cases/delete-musician-presentation-audio/delete-musician-presentation-audio.use-case";
import { GetMusicianUseCase } from "../../../core/musician/application/use-cases/get-musician/get-musician.use-case";
import { ListFeaturedMusiciansUseCase } from "../../../core/musician/application/use-cases/list-featured-musicians/list-featured-musicians.use-case";
import { ListMusicianIdentitiesUseCase } from "../../../core/musician/application/use-cases/list-musician-identities/list-musician-identities.use-case";
import { ListMusiciansUseCase } from "../../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { RegisterPushTokenUseCase } from "../../../core/musician/application/use-cases/register-push-token/register-push-token.use-case";
import { SetMusicianOpenToGigsUseCase } from "../../../core/musician/application/use-cases/set-musician-open-to-gigs/set-musician-open-to-gigs.use-case";
import { SetMusicianRequestScopeUseCase } from "../../../core/musician/application/use-cases/set-musician-request-scope/set-musician-request-scope.use-case";
import { SetMusicianTouringLocationUseCase } from "../../../core/musician/application/use-cases/set-musician-touring-location/set-musician-touring-location.use-case";
import { UpdateMusicianUseCase } from "../../../core/musician/application/use-cases/update-musician/update-musician.use-case";
import { UpdateMusicianProfileUseCase } from "../../../core/musician/application/use-cases/update-musician-profile/update-musician-profile.use-case";
import { UploadMusicianAvatarUseCase } from "../../../core/musician/application/use-cases/upload-musician-avatar/upload-musician-avatar.use-case";
import { UploadMusicianPresentationAudioUseCase } from "../../../core/musician/application/use-cases/upload-musician-presentation-audio/upload-musician-presentation-audio.use-case";
import { UploadQrLogoUseCase } from "../../../core/musician/application/use-cases/upload-qr-logo/upload-qr-logo.use-case";
import { VerifyMusicianUseCase } from "../../../core/musician/application/use-cases/verify-musician/verify-musician.use-case";
import {
  Musician,
  MusicianId,
} from "../../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../core/musician/domain/musician.repository";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { PlanLimitExceededError } from "../../../core/plans/domain/errors/plan-limit-exceeded.error";
import { PlanCheckService } from "../../../core/plans/domain/plan-check.service";
import { SubscriptionInMemoryRepository } from "../../../core/plans/infra/db/in-memory/subscription-in-memory.repository";
import { Location } from "../../../core/shared/domain/value-objects/location.vo";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import {
  MusicianCollectionPresenter,
  MusicianPresenter,
  PublicMusicianPresenter,
} from "../musician.presenter";
import { MusiciansController } from "../musicians.controller";
import {
  ListMusiciansFixture,
  UpdateMusicianFixture,
} from "../testing/musician-fixture";

describe("MusiciansController Integration Tests", () => {
  let controller: MusiciansController;
  let repository: IMusicianRepository;

  beforeEach(async () => {
    const repositoryInstance = new MusicianInMemoryRepository();

    const moduleBuilder = Test.createTestingModule({
      controllers: [MusiciansController],
      providers: [
        {
          provide: "MusicianRepository",
          useValue: repositoryInstance,
        },
        {
          provide: ListMusicianIdentitiesUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new ListMusicianIdentitiesUseCase(repo),
          inject: ["MusicianRepository"],
        },
        {
          provide: ClearPushTokenUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new ClearPushTokenUseCase(repo),
          inject: ["MusicianRepository"],
        },
        {
          provide: UpdateMusicianUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new UpdateMusicianUseCase(repo),
          inject: ["MusicianRepository"],
        },
        {
          provide: UpdateMusicianProfileUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new UpdateMusicianProfileUseCase(repo),
          inject: ["MusicianRepository"],
        },
        {
          provide: RegisterPushTokenUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new RegisterPushTokenUseCase(repo),
          inject: ["MusicianRepository"],
        },
        {
          provide: SetMusicianTouringLocationUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new SetMusicianTouringLocationUseCase(repo),
          inject: ["MusicianRepository"],
        },
        {
          provide: ClearMusicianTouringLocationUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new ClearMusicianTouringLocationUseCase(repo),
          inject: ["MusicianRepository"],
        },
        {
          provide: ListMusiciansUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new ListMusiciansUseCase(repo),
          inject: ["MusicianRepository"],
        },
        {
          provide: SetMusicianOpenToGigsUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new SetMusicianOpenToGigsUseCase(repo),
          inject: ["MusicianRepository"],
        },
        {
          provide: SetMusicianRequestScopeUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new SetMusicianRequestScopeUseCase(repo),
          inject: ["MusicianRepository"],
        },
        {
          provide: GetMusicianUseCase,
          useFactory: (
            repo: IMusicianRepository,
            planCheck: PlanCheckService,
          ) => new GetMusicianUseCase(repo, planCheck),
          inject: ["MusicianRepository", "PlanCheckService"],
        },
        {
          provide: VerifyMusicianUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new VerifyMusicianUseCase(repo),
          inject: ["MusicianRepository"],
        },
        {
          provide: "PlanCheckService",
          useValue: new PlanCheckService(new SubscriptionInMemoryRepository()),
        },
        {
          provide: "MusicianStorage",
          useValue: {
            putObject: jest.fn().mockResolvedValue(undefined),
            deleteObject: jest.fn().mockResolvedValue(undefined),
            getPublicUrl: jest
              .fn()
              .mockImplementation((key: string) => `https://cdn.test/${key}`),
          } satisfies IMusicianStorage,
        },
        {
          provide: UploadMusicianAvatarUseCase,
          useFactory: (repo: IMusicianRepository, storage: IMusicianStorage) =>
            new UploadMusicianAvatarUseCase(repo, storage),
          inject: ["MusicianRepository", "MusicianStorage"],
        },
        {
          provide: UploadMusicianPresentationAudioUseCase,
          useFactory: (repo: IMusicianRepository, storage: IMusicianStorage) =>
            new UploadMusicianPresentationAudioUseCase(repo, storage),
          inject: ["MusicianRepository", "MusicianStorage"],
        },
        {
          provide: DeleteMusicianPresentationAudioUseCase,
          useFactory: (repo: IMusicianRepository, storage: IMusicianStorage) =>
            new DeleteMusicianPresentationAudioUseCase(repo, storage),
          inject: ["MusicianRepository", "MusicianStorage"],
        },
        {
          provide: CustomizeQRCodeUseCase,
          useFactory: (
            repo: IMusicianRepository,
            planCheck: PlanCheckService,
          ) => new CustomizeQRCodeUseCase(repo, planCheck),
          inject: ["MusicianRepository", "PlanCheckService"],
        },
        {
          provide: ListFeaturedMusiciansUseCase,
          useFactory: (
            repo: IMusicianRepository,
            planCheck: PlanCheckService,
          ) => new ListFeaturedMusiciansUseCase(repo, planCheck),
          inject: ["MusicianRepository", "PlanCheckService"],
        },
        {
          provide: UploadQrLogoUseCase,
          useFactory: (
            repo: IMusicianRepository,
            storage: IMusicianStorage,
            planCheck: PlanCheckService,
          ) => new UploadQrLogoUseCase(repo, storage, planCheck),
          inject: ["MusicianRepository", "MusicianStorage", "PlanCheckService"],
        },
      ],
    });

    const module: TestingModule =
      await applyAuthGuardMocks(moduleBuilder).compile();

    controller = module.get<MusiciansController>(MusiciansController);
    repository = module.get<IMusicianRepository>("MusicianRepository");
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(controller["updateUseCase"]).toBeInstanceOf(UpdateMusicianUseCase);
    expect(controller["listUseCase"]).toBeInstanceOf(ListMusiciansUseCase);
    expect(controller["getUseCase"]).toBeInstanceOf(GetMusicianUseCase);
    expect(controller["clearPushTokenUseCase"]).toBeInstanceOf(
      ClearPushTokenUseCase,
    );
  });

  describe("qr-code/customize — gate de plano", () => {
    it("FREE: rejeita com PlanLimitExceededError (mapeado para 402 pelo GlobalExceptionFilter — ver global-exception.filter.spec.ts)", async () => {
      const musician = Musician.fake().aMusician().build();
      await repository.insert(musician);

      await expect(
        controller.customizeQRCode(musician.musician_id.id, {
          foreground_color: "#000000",
        }),
      ).rejects.toThrow(PlanLimitExceededError);
    });
  });

  describe("should update a musician", () => {
    const arrange = UpdateMusicianFixture.arrangeForUpdate();

    const musician = Musician.fake()
      .aMusician()
      .withName("Original Name")
      .withEmail("original@example.com")
      .withGenres(["Rock"])
      .withInstruments(["Guitar"])
      .build();

    beforeEach(async () => {
      await repository.insert(musician);
    });

    test.each(arrange)(
      "when body is $send_data",
      async ({ send_data, expected }) => {
        const presenter = await controller.update(
          musician.musician_id.id,
          send_data as any,
        );
        const entity = await repository.findById(new MusicianId(presenter.id));

        expect(entity!.toJSON()).toMatchObject(expected);
        expect(presenter.qr_code).toBe(
          `https://soundmeet.com.br/musico/${presenter.id}`,
        );

        const output = MusicianOutputMapper.toOutput(entity!);
        expect(presenter).toEqual(new MusicianPresenter(output));
      },
    );
  });

  it("should get a musician — dono autenticado recebe email/telefone", async () => {
    const musician = Musician.fake()
      .aMusician()
      .withName("John Doe")
      .withEmail("john@example.com")
      .withGenres(["Rock"])
      .withInstruments(["Guitar"])
      .build();
    await repository.insert(musician);

    const ownerUser = {
      userId: musician.musician_id.id,
      roles: ["musician"],
      establishmentIds: [],
      bandIds: [],
      isAdmin: false,
    };
    const presenter = (await controller.findOne(
      musician.musician_id.id,
      ownerUser as any,
    )) as MusicianPresenter;

    expect(presenter).toBeInstanceOf(MusicianPresenter);
    expect(presenter.id).toBe(musician.musician_id.id);
    expect(presenter.name).toBe(musician.name);
    expect(presenter.email).toBe(musician.email.value);
    expect(presenter.genres).toEqual(musician.genres);
    expect(presenter.instruments).toEqual(musician.instruments);
    expect(presenter.qr_code).toBe(
      `https://soundmeet.com.br/musico/${musician.musician_id.id}`,
    );
  });

  // 1.d (auditoria jul/2026): GET /musicians/:id é @Public() — sem esse
  // teste, um estranho ou um chamador anônimo receberiam email/telefone do
  // músico, dado pessoal sensível e chave anti-multi-conta (business-rules).
  it("should get a musician — estranho/anônimo recebe versão pública, sem email/telefone", async () => {
    const musician = Musician.fake()
      .aMusician()
      .withName("John Doe")
      .withEmail("john@example.com")
      .build();
    await repository.insert(musician);

    const anonymousView = await controller.findOne(musician.musician_id.id);
    const strangerUser = {
      userId: "other-musician-uuid",
      roles: ["musician"],
      establishmentIds: [],
      bandIds: [],
      isAdmin: false,
    };
    const strangerView = await controller.findOne(
      musician.musician_id.id,
      strangerUser as any,
    );

    for (const presenter of [anonymousView, strangerView]) {
      expect(presenter).toBeInstanceOf(PublicMusicianPresenter);
      expect(presenter).not.toHaveProperty("email");
      expect(presenter).not.toHaveProperty("phone");
      expect(presenter.id).toBe(musician.musician_id.id);
      expect(presenter.name).toBe(musician.name);
    }
  });

  describe("findAll method", () => {
    describe("should sorted musicians by created_at", () => {
      const { entitiesMap, arrange } =
        ListMusiciansFixture.arrangeIncrementedWithCreatedAt();

      beforeEach(async () => {
        await repository.bulkInsert(Object.values(entitiesMap));
      });

      test.each(arrange)(
        "when send_data is $send_data",
        async ({ send_data, expected }) => {
          const presenter = await controller.findAll(send_data as any);
          const { entities, ...paginationProps } = expected;

          expect(presenter).toEqual(
            new MusicianCollectionPresenter({
              items: entities.map(MusicianOutputMapper.toOutput),
              ...paginationProps.meta,
            }),
          );
        },
      );
    });

    describe("should return musicians using pagination, sort and filter", () => {
      const { entitiesMap, arrange } = ListMusiciansFixture.arrangeUnsorted();

      beforeEach(async () => {
        await repository.bulkInsert(Object.values(entitiesMap));
      });

      test.each(arrange)(
        "when send_data is $send_data",
        async ({ send_data, expected }) => {
          const presenter = await controller.findAll(send_data as any);
          const { entities, ...paginationProps } = expected;

          expect(presenter).toEqual(
            new MusicianCollectionPresenter({
              items: entities.map(MusicianOutputMapper.toOutput),
              ...paginationProps.meta,
            }),
          );
        },
      );
    });
  });

  it("push token: registra, apaga, e nenhum dos dois devolve o perfil", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);
    const id = musician.musician_id.id;

    const registered = await controller.registerPushToken(id, {
      push_token: "ExpoPushToken[novo-formato]",
      push_token_platform: "ios",
    } as any);
    expect(registered).toBeUndefined();
    expect((await repository.findById(musician.musician_id))!.push_token).toBe(
      "ExpoPushToken[novo-formato]",
    );

    const cleared = await controller.clearPushToken(id);
    expect(cleared).toBeUndefined();
    const found = await repository.findById(musician.musician_id);
    expect(found!.push_token).toBeNull();
    expect(found!.push_token_platform).toBeNull();
  });

  describe("busca pública", () => {
    it("não lista músico desativado, mesmo com o radar ligado", async () => {
      const active = Musician.fake()
        .aMusician()
        .withName("Ativo")
        .withOpenToGigs(true)
        .build();
      const inactive = Musician.fake()
        .aMusician()
        .withName("Desativado")
        .withOpenToGigs(true)
        .deactivate()
        .build();
      await repository.bulkInsert([active, inactive]);

      const presenter = await controller.findAll({} as any);

      expect(presenter.data.map((item) => item.name)).toEqual(["Ativo"]);
    });

    it("`q` acha pelo nome ARTÍSTICO, que é o que a tela mostra", async () => {
      const carlao = Musician.fake()
        .aMusician()
        .withName("Carlos Teclas")
        .withStageName("Carlão do Piano")
        .withOpenToGigs(true)
        .build();
      const other = Musician.fake()
        .aMusician()
        .withName("Beatriz Cordas")
        .withStageName("Bia Viola")
        .withOpenToGigs(true)
        .build();
      await repository.bulkInsert([carlao, other]);

      const byStage = await controller.findAll({
        filter: { q: "carlão" },
      } as any);
      const byLegal = await controller.findAll({
        filter: { q: "Beatriz" },
      } as any);

      expect(byStage.data.map((item) => item.stage_name)).toEqual([
        "Carlão do Piano",
      ]);
      expect(byLegal.data.map((item) => item.stage_name)).toEqual([
        "Bia Viola",
      ]);
    });

    it("a lista sai sem endereço nem coordenada: só cidade e estado", async () => {
      const musician = Musician.fake().aMusician().withOpenToGigs(true).build();
      musician.ensureProfile().changeLocation(
        new Location({
          city: "Curitiba",
          state: "PR",
          street: "Rua XV de Novembro",
          number: "1742-K",
          neighborhood: "Centro",
          zip_code: "80020310",
          latitude: -25.42896,
          longitude: -49.26713,
        }),
      );
      await repository.insert(musician);

      const presenter = await controller.findAll({} as any);
      const serialized = JSON.stringify(presenter);

      expect(presenter.data[0].profile!.location).toEqual({
        city: "Curitiba",
        state: "PR",
      });
      for (const leaked of [
        "Rua XV",
        "1742-K",
        "80020310",
        "Centro",
        "25.42",
      ]) {
        expect(serialized).not.toContain(leaked);
      }
    });

    it("com origem na busca, cada item traz a distância em km inteiros", async () => {
      const musician = Musician.fake().aMusician().withOpenToGigs(true).build();
      musician.ensureProfile().changeLocation(
        new Location({
          city: "São Paulo",
          state: "SP",
          latitude: -23.5614,
          longitude: -46.6559,
        }),
      );
      await repository.insert(musician);

      const withOrigin = await controller.findAll({
        filter: { lat: -23.5338, lng: -46.6559 },
      } as any);
      const withoutOrigin = await controller.findAll({} as any);

      expect(withOrigin.data[0].distance_km).toBe(3);
      expect(withoutOrigin.data[0].distance_km).toBeNull();
    });
  });

  describe("GET /musicians/identities", () => {
    it("resolve vários ids de uma vez, inclusive quem está com o radar desligado", async () => {
      const visible = Musician.fake()
        .aMusician()
        .withStageName("Rafa Sax")
        .withOpenToGigs(true)
        .build();
      const radarOff = Musician.fake()
        .aMusician()
        .withName("Maria Voz")
        .withStageName("Maria Bossa")
        .withOpenToGigs(null)
        .build();
      await repository.bulkInsert([visible, radarOff]);

      const presenters = await controller.findIdentities({
        ids: [radarOff.musician_id.id, visible.musician_id.id],
      });

      expect(presenters.map((item) => item.display_name)).toEqual([
        "Maria Bossa",
        "Rafa Sax",
      ]);
      expect(JSON.stringify(presenters)).not.toContain(radarOff.email.value);
    });
  });

  it("should set open_to_gigs, never defaulting to true", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    expect(musician.open_to_gigs).toBeNull();

    const presenter = await controller.setOpenToGigs(musician.musician_id.id, {
      open_to_gigs: true,
    } as any);

    expect(presenter.open_to_gigs).toBe(true);

    const found = await repository.findById(musician.musician_id);
    expect(found!.open_to_gigs).toBe(true);
  });
});
