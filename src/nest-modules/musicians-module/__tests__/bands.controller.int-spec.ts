import { Test, TestingModule } from "@nestjs/testing";

import { AddBandMemberUseCase } from "../../../core/musician/application/use-cases/add-band-member/add-band-member.use-case";
import { BandOutputMapper } from "../../../core/musician/application/use-cases/common/band-output";
import { CreateBandUseCase } from "../../../core/musician/application/use-cases/create-band/create-band.use-case";
import { GetBandUseCase } from "../../../core/musician/application/use-cases/get-band/get-band.use-case";
import { RemoveBandMemberUseCase } from "../../../core/musician/application/use-cases/remove-band-member/remove-band-member.use-case";
import { Band, BandId } from "../../../core/musician/domain/band.aggregate";
import { IBandRepository } from "../../../core/musician/domain/band.repository";
import {
  Musician,
  MusicianId,
} from "../../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../core/musician/domain/musician.repository";
import { BandInMemoryRepository } from "../../../core/musician/infra/db/in-memory/band-in-memory.repository";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { BandPresenter } from "../band.presenter";
import { BandsController } from "../bands.controller";
import { CreateBandFixture } from "../testing/band-fixture";

describe("BandsController Integration Tests", () => {
  let controller: BandsController;
  let bandRepository: IBandRepository;
  let musicianRepository: IMusicianRepository;

  beforeEach(async () => {
    const bandRepositoryInstance = new BandInMemoryRepository();
    const musicianRepositoryInstance = new MusicianInMemoryRepository();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BandsController],
      providers: [
        {
          provide: "BandRepository",
          useValue: bandRepositoryInstance,
        },
        {
          provide: "MusicianRepository",
          useValue: musicianRepositoryInstance,
        },
        {
          provide: CreateBandUseCase,
          useFactory: (repo: IBandRepository) => new CreateBandUseCase(repo),
          inject: ["BandRepository"],
        },
        {
          provide: GetBandUseCase,
          useFactory: (repo: IBandRepository) => new GetBandUseCase(repo),
          inject: ["BandRepository"],
        },
        {
          provide: AddBandMemberUseCase,
          useFactory: (
            bandRepo: IBandRepository,
            musicianRepo: IMusicianRepository,
          ) => new AddBandMemberUseCase(bandRepo, musicianRepo),
          inject: ["BandRepository", "MusicianRepository"],
        },
        {
          provide: RemoveBandMemberUseCase,
          useFactory: (repo: IBandRepository) =>
            new RemoveBandMemberUseCase(repo),
          inject: ["BandRepository"],
        },
      ],
    }).compile();

    controller = module.get<BandsController>(BandsController);
    bandRepository = module.get<IBandRepository>("BandRepository");
    musicianRepository = module.get<IMusicianRepository>("MusicianRepository");
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(controller["createBandUseCase"]).toBeInstanceOf(CreateBandUseCase);
    expect(controller["getBandUseCase"]).toBeInstanceOf(GetBandUseCase);
    expect(controller["addBandMemberUseCase"]).toBeInstanceOf(
      AddBandMemberUseCase,
    );
    expect(controller["removeBandMemberUseCase"]).toBeInstanceOf(
      RemoveBandMemberUseCase,
    );
  });

  describe("should create a band", () => {
    const arrange = CreateBandFixture.arrangeForCreate();

    test.each(arrange)(
      "when body is $send_data",
      async ({ send_data, expected }) => {
        const presenter = await controller.create(send_data as any);
        const entity = await bandRepository.findById(new BandId(presenter.id));

        expect(entity).toBeInstanceOf(Band);
        expect(entity!.toJSON()).toMatchObject(expected);

        const output = BandOutputMapper.toOutput(entity!);
        expect(presenter).toEqual(new BandPresenter(output));
      },
    );
  });

  it("should get a band", async () => {
    const band = Band.fake()
      .aBand()
      .withName("My Band")
      .withGenres(["Rock"])
      .build();
    await bandRepository.insert(band);

    const presenter = await controller.findOne(band.band_id.id);

    expect(presenter.id).toBe(band.band_id.id);
    expect(presenter.name).toBe(band.name);
    expect(presenter.genres).toEqual(band.genres);
    expect(presenter.members).toEqual([]);
  });

  it("should add and remove a member", async () => {
    const musician = Musician.fake()
      .aMusician()
      .withName("Member")
      .withEmail("member@example.com")
      .withGenres(["Rock"])
      .withInstruments(["Guitar"])
      .build();
    await musicianRepository.insert(musician);

    const band = Band.fake()
      .aBand()
      .withName("My Band")
      .withGenres(["Rock"])
      .build();
    await bandRepository.insert(band);

    const presenterAfterAdd = await controller.addMember(band.band_id.id, {
      musician_id: musician.id.id,
      role: "member",
      instrument: "Guitar",
    } as any);

    expect(presenterAfterAdd.members).toHaveLength(1);
    expect(presenterAfterAdd.members[0].musician_id).toBeInstanceOf(MusicianId);
    expect(presenterAfterAdd.members[0].musician_id.id).toBe(musician.id.id);

    const bandAfterAdd = await bandRepository.findById(band.band_id);
    expect(bandAfterAdd!.members).toHaveLength(1);

    const response = await controller.removeMember(
      band.band_id.id,
      musician.id.id,
    );
    expect(response).not.toBeDefined();

    const bandAfterRemove = await bandRepository.findById(band.band_id);
    expect(bandAfterRemove!.members).toHaveLength(0);
  });
});
