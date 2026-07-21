import { Test, TestingModule } from "@nestjs/testing";

import { AttendEventUseCase } from "../../../core/audience/application/use-cases/attend-event/attend-event.use-case";
import { AudienceOutputMapper } from "../../../core/audience/application/use-cases/common/audience-output";
import { CompleteProfileUseCase } from "../../../core/audience/application/use-cases/complete-profile/complete-profile.use-case";
import { CreateAudienceUseCase } from "../../../core/audience/application/use-cases/create-audience/create-audience.use-case";
import { DeleteAudienceUseCase } from "../../../core/audience/application/use-cases/delete-audience/delete-audience.use-case";
import { GetAudienceUseCase } from "../../../core/audience/application/use-cases/get-audience/get-audience.use-case";
import { IndicateMusicianUseCase } from "../../../core/audience/application/use-cases/indicate-musician/indicate-musician.use-case";
import { ListAudiencesUseCase } from "../../../core/audience/application/use-cases/list-audiences/list-audiences.use-case";
import { MakeMusicRequestUseCase } from "../../../core/audience/application/use-cases/make-music-request/make-music-request.use-case";
import { RecommendMusiciansUseCase } from "../../../core/audience/application/use-cases/recommend-musicians/recommend-musicians.use-case";
import { ScanQRUseCase } from "../../../core/audience/application/use-cases/scan-qr/scan-qr.use-case";
import { SendTipUseCase } from "../../../core/audience/application/use-cases/send-tip/send-tip.use-case";
import { ShareSocialMediaUseCase } from "../../../core/audience/application/use-cases/share-social-media/share-social-media.use-case";
import { UpdateAudienceUseCase } from "../../../core/audience/application/use-cases/update-audience/update-audience.use-case";
import { VoteSongUseCase } from "../../../core/audience/application/use-cases/vote-song/vote-song.use-case";
import {
  Audience,
  AudienceId,
} from "../../../core/audience/domain/audience.aggregate";
import { IAudienceRepository } from "../../../core/audience/domain/audience.repository";
import { AudienceInMemoryRepository } from "../../../core/audience/infra/db/in-memory/audience-in-memory.repository";
import { IUserInteractionRepository } from "../../../core/gamification/domain/user-interaction.repository";
import { UserInteractionInMemoryRepository } from "../../../core/gamification/infra/db/in-memory/user-interaction-in-memory.repository";
import { Musician } from "../../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../core/musician/domain/musician.repository";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { Uuid } from "../../../core/shared/domain/value-objects/uuid.vo";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import { MusicianCollectionPresenter } from "../../musicians-module/musician.presenter";
import {
  AudienceCollectionPresenter,
  AudiencePresenter,
  MakeMusicRequestPresenter,
  ScanQRPresenter,
  SendTipPresenter,
} from "../audience.presenter";
import { AudiencesController } from "../audiences.controller";
import {
  CreateAudienceFixture,
  ListAudiencesFixture,
  UpdateAudienceFixture,
} from "../testing/audience-fixture";

describe("AudiencesController Integration Tests", () => {
  let controller: AudiencesController;
  let audienceRepository: IAudienceRepository;
  let musicianRepository: IMusicianRepository;
  let userInteractionRepository: IUserInteractionRepository;

  beforeEach(async () => {
    const audienceRepositoryInstance = new AudienceInMemoryRepository();
    const musicianRepositoryInstance = new MusicianInMemoryRepository();
    const userInteractionRepositoryInstance =
      new UserInteractionInMemoryRepository();

    const moduleBuilder = Test.createTestingModule({
      controllers: [AudiencesController],
      providers: [
        {
          provide: "AudienceRepository",
          useValue: audienceRepositoryInstance,
        },
        {
          provide: "MusicianRepository",
          useValue: musicianRepositoryInstance,
        },
        {
          provide: "UserInteractionRepository",
          useValue: userInteractionRepositoryInstance,
        },
        {
          provide: CreateAudienceUseCase,
          useFactory: (repo: IAudienceRepository) =>
            new CreateAudienceUseCase(repo),
          inject: ["AudienceRepository"],
        },
        {
          provide: UpdateAudienceUseCase,
          useFactory: (repo: IAudienceRepository) =>
            new UpdateAudienceUseCase(repo),
          inject: ["AudienceRepository"],
        },
        {
          provide: DeleteAudienceUseCase,
          useFactory: (repo: IAudienceRepository) =>
            new DeleteAudienceUseCase(repo),
          inject: ["AudienceRepository"],
        },
        {
          provide: GetAudienceUseCase,
          useFactory: (repo: IAudienceRepository) =>
            new GetAudienceUseCase(repo),
          inject: ["AudienceRepository"],
        },
        {
          provide: ListAudiencesUseCase,
          useFactory: (repo: IAudienceRepository) =>
            new ListAudiencesUseCase(repo),
          inject: ["AudienceRepository"],
        },
        {
          provide: ScanQRUseCase,
          useFactory: (
            repo: IAudienceRepository,
            userInteractionRepo: IUserInteractionRepository,
            musicianRepo: IMusicianRepository,
          ) => {
            const uowMock = {
              do: async (fn: () => Promise<unknown>) => fn(),
            } as any;
            return new ScanQRUseCase(
              repo,
              userInteractionRepo,
              musicianRepo,
              uowMock,
            );
          },
          inject: [
            "AudienceRepository",
            "UserInteractionRepository",
            "MusicianRepository",
          ],
        },
        {
          provide: CompleteProfileUseCase,
          useFactory: (repo: IAudienceRepository) =>
            new CompleteProfileUseCase(repo),
          inject: ["AudienceRepository"],
        },
        {
          provide: AttendEventUseCase,
          useFactory: (repo: IAudienceRepository, addEventAttendee: any) =>
            new AttendEventUseCase(repo, addEventAttendee),
          inject: ["AudienceRepository", "AddEventAttendeeUseCase"],
        },
        {
          provide: MakeMusicRequestUseCase,
          useFactory: (
            repo: IAudienceRepository,
            createRequest: any,
            addPoints: any,
          ) => new MakeMusicRequestUseCase(repo, createRequest, addPoints),
          inject: [
            "AudienceRepository",
            "CreateRequestUseCase",
            "AddPointsUseCase",
          ],
        },
        {
          provide: VoteSongUseCase,
          useFactory: (repo: IAudienceRepository, voteRequest: any) =>
            new VoteSongUseCase(repo, voteRequest),
          inject: ["AudienceRepository", "VoteRequestUseCase"],
        },
        {
          provide: SendTipUseCase,
          useFactory: (repo: IAudienceRepository, paymentSendTip: any) =>
            new SendTipUseCase(repo, paymentSendTip),
          inject: ["AudienceRepository", "PaymentSendTipUseCase"],
        },
        {
          provide: "AddEventAttendeeUseCase",
          useValue: {
            execute: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: "CreateRequestUseCase",
          useValue: {
            execute: jest
              .fn()
              .mockResolvedValue({ id: "request-id", status: "pending" }),
          },
        },
        {
          provide: "AddPointsUseCase",
          useValue: {
            execute: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: "VoteRequestUseCase",
          useValue: {
            execute: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: "PaymentSendTipUseCase",
          useValue: {
            execute: jest
              .fn()
              .mockResolvedValue({ id: "tip-id", status: "pending" }),
          },
        },
        {
          provide: ShareSocialMediaUseCase,
          useFactory: (repo: IAudienceRepository) =>
            new ShareSocialMediaUseCase(repo),
          inject: ["AudienceRepository"],
        },
        {
          provide: IndicateMusicianUseCase,
          useFactory: (repo: IAudienceRepository) =>
            new IndicateMusicianUseCase(repo),
          inject: ["AudienceRepository"],
        },
        {
          provide: RecommendMusiciansUseCase,
          useFactory: (
            audRepo: IAudienceRepository,
            musRepo: IMusicianRepository,
          ) => new RecommendMusiciansUseCase(audRepo, musRepo),
          inject: ["AudienceRepository", "MusicianRepository"],
        },
      ],
    });

    const module: TestingModule = await applyAuthGuardMocks(moduleBuilder).compile();

    controller = module.get<AudiencesController>(AudiencesController);
    audienceRepository = module.get<IAudienceRepository>("AudienceRepository");
    musicianRepository = module.get<IMusicianRepository>("MusicianRepository");
    userInteractionRepository = module.get<IUserInteractionRepository>(
      "UserInteractionRepository",
    );
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect((controller as any).createUseCase).toBeInstanceOf(
      CreateAudienceUseCase,
    );
    expect((controller as any).updateUseCase).toBeInstanceOf(
      UpdateAudienceUseCase,
    );
    expect((controller as any).deleteUseCase).toBeInstanceOf(
      DeleteAudienceUseCase,
    );
    expect((controller as any).getUseCase).toBeInstanceOf(GetAudienceUseCase);
    expect((controller as any).listUseCase).toBeInstanceOf(
      ListAudiencesUseCase,
    );
    expect((controller as any).completeProfileUseCase).toBeInstanceOf(
      CompleteProfileUseCase,
    );
    expect((controller as any).attendEventUseCase).toBeInstanceOf(
      AttendEventUseCase,
    );
    expect((controller as any).scanQRUseCase).toBeInstanceOf(ScanQRUseCase);
    expect((controller as any).makeMusicRequestUseCase).toBeInstanceOf(
      MakeMusicRequestUseCase,
    );
    expect((controller as any).voteSongUseCase).toBeInstanceOf(VoteSongUseCase);
    expect((controller as any).sendTipUseCase).toBeInstanceOf(SendTipUseCase);
    expect((controller as any).shareSocialMediaUseCase).toBeInstanceOf(
      ShareSocialMediaUseCase,
    );
    expect((controller as any).indicateMusicianUseCase).toBeInstanceOf(
      IndicateMusicianUseCase,
    );
    expect((controller as any).recommendMusiciansUseCase).toBeInstanceOf(
      RecommendMusiciansUseCase,
    );
  });

  describe("should create an audience", () => {
    const arrange = CreateAudienceFixture.arrangeForCreate();

    test.each(arrange)(
      "when body is $send_data",
      async ({ send_data, expected }) => {
        const presenter = await controller.create(send_data as any);
        const entity = await audienceRepository.findById(
          new AudienceId(presenter.id),
        );

        expect(entity).toBeInstanceOf(Audience);
        expect(entity!.toJSON()).toMatchObject(expected);

        const output = AudienceOutputMapper.toOutput(entity!);
        expect(presenter).toEqual(new AudiencePresenter(output));
      },
    );
  });

  describe("should update an audience", () => {
    const arrange = UpdateAudienceFixture.arrangeForUpdate();

    const audience = Audience.create({
      name: "Original Name",
      email: "original@example.com",
      favorite_genres: ["Rock"],
      favorite_instruments: ["Guitar"],
      is_active: true,
    });

    beforeEach(async () => {
      await audienceRepository.insert(audience);
    });

    test.each(arrange)(
      "when body is $send_data",
      async ({ send_data, expected }) => {
        const presenter = await controller.update(
          audience.audience_id.id,
          send_data as any,
        );
        const entity = await audienceRepository.findById(
          new AudienceId(presenter.id),
        );

        expect(entity!.toJSON()).toMatchObject(expected);

        const output = AudienceOutputMapper.toOutput(entity!);
        expect(presenter).toEqual(new AudiencePresenter(output));
      },
    );
  });

  it("should delete an audience", async () => {
    const audience = Audience.fake().aAudience().build();
    await audienceRepository.insert(audience);

    const response = await controller.remove(audience.audience_id.id);
    expect(response).not.toBeDefined();

    await expect(
      audienceRepository.findById(audience.audience_id),
    ).resolves.toBeNull();
  });

  it("should get an audience", async () => {
    const audience = Audience.create({
      name: "John Doe",
      email: "john@example.com",
      favorite_genres: ["Rock"],
      favorite_instruments: ["Guitar"],
    });
    await audienceRepository.insert(audience);

    const presenter = await controller.findOne(audience.audience_id.id);

    expect(presenter.id).toBe(audience.audience_id.id);
    expect(presenter.name).toBe(audience.name);
    expect(presenter.email).toBe(audience.email.value);
    expect(presenter.favorite_genres).toEqual(audience.favorite_genres);
    expect(presenter.favorite_instruments).toEqual(
      audience.favorite_instruments,
    );
  });

  describe("findAll method", () => {
    describe("should sort audiences by created_at default behavior", () => {
      const { entitiesMap, arrange } =
        ListAudiencesFixture.arrangeIncrementedWithCreatedAt();

      beforeEach(async () => {
        await audienceRepository.bulkInsert(Object.values(entitiesMap));
      });

      test.each(arrange)(
        "when send_data is $send_data",
        async ({ send_data, expected }) => {
          const presenter = await controller.findAll(send_data as any);
          const { entities, ...paginationProps } = expected;

          expect(presenter).toEqual(
            new AudienceCollectionPresenter({
              items: entities.map(AudienceOutputMapper.toOutput),
              ...paginationProps.meta,
            }),
          );
        },
      );
    });

    describe("should return audiences using pagination, sort and filter", () => {
      const { entitiesMap, arrange } = ListAudiencesFixture.arrangeUnsorted();

      beforeEach(async () => {
        await audienceRepository.bulkInsert(Object.values(entitiesMap));
      });

      test.each(arrange)(
        "when send_data is $send_data",
        async ({ send_data, expected }) => {
          const presenter = await controller.findAll(send_data as any);
          const { entities, ...paginationProps } = expected;

          expect(presenter).toEqual(
            new AudienceCollectionPresenter({
              items: entities.map(AudienceOutputMapper.toOutput),
              ...paginationProps.meta,
            }),
          );
        },
      );
    });
  });

  it("should scan QR code and return ScanQRPresenter", async () => {
    const audience = Audience.create({
      name: "John Doe",
      email: "john@example.com",
    });
    await audienceRepository.insert(audience);

    const musician = Musician.fake().aMusician().build();
    await musicianRepository.insert(musician);

    const presenter = await controller.scanQR(audience.audience_id.id, {
      qr_code: `soundmeet://musician/${musician.musician_id.id}`,
      musician_id: musician.musician_id.id,
    } as any);

    expect(presenter).toBeInstanceOf(ScanQRPresenter);
    expect(presenter.audience.id).toBe(audience.audience_id.id);
    expect(presenter.points_earned.value).toBe(10);
    expect(presenter.scan_metadata.qr_code).toBe(
      `soundmeet://musician/${musician.musician_id.id}`,
    );

    const interactions = await userInteractionRepository.findByUserId(
      audience.audience_id.id,
    );
    expect(interactions).toHaveLength(1);
    expect(interactions[0].interaction_type).toBe("scan_qr");
  });

  it("should make music request and return MakeMusicRequestPresenter", async () => {
    const audience = Audience.create({
      name: "John Doe",
      email: "john@example.com",
    });
    await audienceRepository.insert(audience);

    const eventId = new Uuid().id;

    const presenter = await controller.makeMusicRequest(
      audience.audience_id.id,
      {
        musician_id: "musician_1",
        song_title: "Song",
        artist_name: "Artist",
        event_id: eventId,
      } as any,
    );

    expect(presenter).toBeInstanceOf(MakeMusicRequestPresenter);
    expect(presenter.audience.id).toBe(audience.audience_id.id);
    expect(presenter.points_earned).toBe(25);
    expect(presenter.request_metadata.status).toBe("pending");
  });

  it("should send tip and return SendTipPresenter", async () => {
    const audience = Audience.create({
      name: "John Doe",
      email: "john@example.com",
    });
    await audienceRepository.insert(audience);

    const presenter = await controller.sendTip(audience.audience_id.id, {
      musician_id: "musician_1",
      amount: 10,
      payment_method: "pix",
    } as any);

    expect(presenter).toBeInstanceOf(SendTipPresenter);
    expect(presenter.audience.id).toBe(audience.audience_id.id);
    expect(presenter.points_earned).toBe(0);
    expect(presenter.tip_metadata.status).toBe("pending");
  });

  it("should recommend musicians based on audience preferences", async () => {
    const audience = Audience.create({
      name: "John Doe",
      email: "john@example.com",
      favorite_instruments: ["Guitar"],
      favorite_genres: ["Rock"],
    });
    await audienceRepository.insert(audience);

    await musicianRepository.insert(
      Musician.fake()
        .aMusician()
        .withGenres(["Rock"])
        .withInstruments(["Guitar"])
        .withOpenToGigs(true)
        .build(),
    );
    await musicianRepository.insert(
      Musician.fake()
        .aMusician()
        .withGenres(["Rock"])
        .withInstruments(["Guitar"])
        .withOpenToGigs(true)
        .build(),
    );
    await musicianRepository.insert(
      Musician.fake()
        .aMusician()
        .withGenres(["Jazz"])
        .withInstruments(["Piano"])
        .withOpenToGigs(true)
        .build(),
    );

    const presenter = await controller.recommendMusicians(
      audience.audience_id.id,
      {
        per_page: 10,
      } as any,
    );

    expect(presenter).toBeInstanceOf(MusicianCollectionPresenter);
    expect(presenter.data).toHaveLength(2);
    expect(presenter.data[0]).toHaveProperty("id");
    expect(presenter.data[0]).toHaveProperty("genres");
    expect(presenter.data[0]).toHaveProperty("instruments");
  });
});
