import { Test, TestingModule } from "@nestjs/testing";

import { MusicianOutputMapper } from "../../../core/musician/application/use-cases/common/musician-profile-output";
import { CreateMusicianUseCase } from "../../../core/musician/application/use-cases/create-musician/create-musician.use-case";
import { DeleteMusicianUseCase } from "../../../core/musician/application/use-cases/delete-musician/delete-musician.use-case";
import { GetMusicianUseCase } from "../../../core/musician/application/use-cases/get-musician/get-musician.use-case";
import { ListMusiciansUseCase } from "../../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { UpdateMusicianUseCase } from "../../../core/musician/application/use-cases/update-musician/update-musician.use-case";
import { UpdateMusicianProfileUseCase } from "../../../core/musician/application/use-cases/update-musician-profile/update-musician-profile.use-case";
import {
  Musician,
  MusicianId,
} from "../../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../core/musician/domain/musician.repository";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import {
  MusicianCollectionPresenter,
  MusicianPresenter,
} from "../musician.presenter";
import { MusiciansController } from "../musicians.controller";
import {
  CreateMusicianFixture,
  ListMusiciansFixture,
  UpdateMusicianFixture,
} from "../testing/musician-fixture";

describe("MusiciansController Integration Tests", () => {
  let controller: MusiciansController;
  let repository: IMusicianRepository;

  beforeEach(async () => {
    const repositoryInstance = new MusicianInMemoryRepository();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MusiciansController],
      providers: [
        {
          provide: "MusicianRepository",
          useValue: repositoryInstance,
        },
        {
          provide: CreateMusicianUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new CreateMusicianUseCase(repo),
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
          provide: ListMusiciansUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new ListMusiciansUseCase(repo),
          inject: ["MusicianRepository"],
        },
        {
          provide: GetMusicianUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new GetMusicianUseCase(repo),
          inject: ["MusicianRepository"],
        },
        {
          provide: DeleteMusicianUseCase,
          useFactory: (repo: IMusicianRepository) =>
            new DeleteMusicianUseCase(repo),
          inject: ["MusicianRepository"],
        },
      ],
    }).compile();

    controller = module.get<MusiciansController>(MusiciansController);
    repository = module.get<IMusicianRepository>("MusicianRepository");
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(controller["createUseCase"]).toBeInstanceOf(CreateMusicianUseCase);
    expect(controller["updateUseCase"]).toBeInstanceOf(UpdateMusicianUseCase);
    expect(controller["listUseCase"]).toBeInstanceOf(ListMusiciansUseCase);
    expect(controller["getUseCase"]).toBeInstanceOf(GetMusicianUseCase);
    expect(controller["deleteUseCase"]).toBeInstanceOf(DeleteMusicianUseCase);
  });

  describe("should create a musician", () => {
    const arrange = CreateMusicianFixture.arrangeForCreate();

    test.each(arrange)(
      "when body is $send_data",
      async ({ send_data, expected }) => {
        const presenter = await controller.create(send_data as any);
        const entity = await repository.findById(new MusicianId(presenter.id));

        expect(entity).toBeInstanceOf(Musician);
        expect(entity!.toJSON()).toMatchObject(expected);
        expect(presenter.qr_code).toBe(`soundmeet://musician/${presenter.id}`);

        const output = MusicianOutputMapper.toOutput(entity!);
        expect(presenter).toEqual(new MusicianPresenter(output));
      },
    );
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
        expect(presenter.qr_code).toBe(`soundmeet://musician/${presenter.id}`);

        const output = MusicianOutputMapper.toOutput(entity!);
        expect(presenter).toEqual(new MusicianPresenter(output));
      },
    );
  });

  it("should delete a musician", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    const response = await controller.remove(musician.musician_id.id);
    expect(response).not.toBeDefined();

    await expect(repository.findById(musician.musician_id)).resolves.toBeNull();
  });

  it("should get a musician", async () => {
    const musician = Musician.fake()
      .aMusician()
      .withName("John Doe")
      .withEmail("john@example.com")
      .withGenres(["Rock"])
      .withInstruments(["Guitar"])
      .build();
    await repository.insert(musician);

    const presenter = await controller.findOne(musician.musician_id.id);

    expect(presenter.id).toBe(musician.musician_id.id);
    expect(presenter.name).toBe(musician.name);
    expect(presenter.email).toBe(musician.email.value);
    expect(presenter.genres).toEqual(musician.genres);
    expect(presenter.instruments).toEqual(musician.instruments);
    expect(presenter.qr_code).toBe(
      `soundmeet://musician/${musician.musician_id.id}`,
    );
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
});
