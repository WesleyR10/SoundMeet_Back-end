import { Test, TestingModule } from "@nestjs/testing";

import { AcceptBandInviteUseCase } from "../../../core/musician/application/use-cases/accept-band-invite/accept-band-invite.use-case";
import { BandOutputMapper } from "../../../core/musician/application/use-cases/common/band-output";
import { CreateBandUseCase } from "../../../core/musician/application/use-cases/create-band/create-band.use-case";
import { DeclineBandInviteUseCase } from "../../../core/musician/application/use-cases/decline-band-invite/decline-band-invite.use-case";
import { DeleteBandUseCase } from "../../../core/musician/application/use-cases/delete-band/delete-band.use-case";
import { GetBandUseCase } from "../../../core/musician/application/use-cases/get-band/get-band.use-case";
import { InviteBandMemberUseCase } from "../../../core/musician/application/use-cases/invite-band-member/invite-band-member.use-case";
import { ListBandsUseCase } from "../../../core/musician/application/use-cases/list-bands/list-bands.use-case";
import { RemoveBandMemberUseCase } from "../../../core/musician/application/use-cases/remove-band-member/remove-band-member.use-case";
import { SetBandOpenToGigsUseCase } from "../../../core/musician/application/use-cases/set-band-open-to-gigs/set-band-open-to-gigs.use-case";
import { UpdateBandUseCase } from "../../../core/musician/application/use-cases/update-band/update-band.use-case";
import { Band, BandId } from "../../../core/musician/domain/band.aggregate";
import { IBandRepository } from "../../../core/musician/domain/band.repository";
import { Musician } from "../../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../core/musician/domain/musician.repository";
import { BandInMemoryRepository } from "../../../core/musician/infra/db/in-memory/band-in-memory.repository";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
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

    const moduleBuilder = Test.createTestingModule({
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
          provide: UpdateBandUseCase,
          useFactory: (repo: IBandRepository) => new UpdateBandUseCase(repo),
          inject: ["BandRepository"],
        },
        {
          provide: DeleteBandUseCase,
          useFactory: (repo: IBandRepository) => new DeleteBandUseCase(repo),
          inject: ["BandRepository"],
        },
        {
          provide: GetBandUseCase,
          useFactory: (repo: IBandRepository) => new GetBandUseCase(repo),
          inject: ["BandRepository"],
        },
        {
          provide: ListBandsUseCase,
          useFactory: (repo: IBandRepository) => new ListBandsUseCase(repo),
          inject: ["BandRepository"],
        },
        {
          provide: InviteBandMemberUseCase,
          useFactory: (
            bandRepo: IBandRepository,
            musicianRepo: IMusicianRepository,
          ) => new InviteBandMemberUseCase(bandRepo, musicianRepo),
          inject: ["BandRepository", "MusicianRepository"],
        },
        {
          provide: RemoveBandMemberUseCase,
          useFactory: (repo: IBandRepository) =>
            new RemoveBandMemberUseCase(repo),
          inject: ["BandRepository"],
        },
        {
          provide: AcceptBandInviteUseCase,
          useFactory: (repo: IBandRepository) =>
            new AcceptBandInviteUseCase(repo),
          inject: ["BandRepository"],
        },
        {
          provide: DeclineBandInviteUseCase,
          useFactory: (repo: IBandRepository) =>
            new DeclineBandInviteUseCase(repo),
          inject: ["BandRepository"],
        },
        {
          provide: SetBandOpenToGigsUseCase,
          useFactory: (repo: IBandRepository) =>
            new SetBandOpenToGigsUseCase(repo),
          inject: ["BandRepository"],
        },
      ],
    });

    const module: TestingModule =
      await applyAuthGuardMocks(moduleBuilder).compile();

    controller = module.get<BandsController>(BandsController);
    bandRepository = module.get<IBandRepository>("BandRepository");
    musicianRepository = module.get<IMusicianRepository>("MusicianRepository");
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(controller["createBandUseCase"]).toBeInstanceOf(CreateBandUseCase);
    expect(controller["updateBandUseCase"]).toBeInstanceOf(UpdateBandUseCase);
    expect(controller["deleteBandUseCase"]).toBeInstanceOf(DeleteBandUseCase);
    expect(controller["getBandUseCase"]).toBeInstanceOf(GetBandUseCase);
    expect(controller["listBandsUseCase"]).toBeInstanceOf(ListBandsUseCase);
    expect(controller["inviteBandMemberUseCase"]).toBeInstanceOf(
      InviteBandMemberUseCase,
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
      musician_id: musician.musician_id.id,
      role: "member",
      instrument: "Guitar",
    } as any);

    expect(presenterAfterAdd.members).toHaveLength(1);
    expect(presenterAfterAdd.members[0].musician_id).toBe(
      musician.musician_id.id,
    );

    const bandAfterAdd = await bandRepository.findById(band.band_id);
    expect(bandAfterAdd!.members).toHaveLength(1);

    const response = await controller.removeMember(
      band.band_id.id,
      musician.musician_id.id,
    );
    expect(response).not.toBeDefined();

    const bandAfterRemove = await bandRepository.findById(band.band_id);
    expect(bandAfterRemove!.members).toHaveLength(0);
  });

  it("should invite a member as pending, then let the invited musician accept", async () => {
    const musician = Musician.fake()
      .aMusician()
      .withName("Invited")
      .withEmail("invited@example.com")
      .build();
    await musicianRepository.insert(musician);

    const band = Band.fake().aBand().withName("My Band").build();
    await bandRepository.insert(band);

    const presenterAfterInvite = await controller.addMember(band.band_id.id, {
      musician_id: musician.musician_id.id,
      role: "member",
      instrument: "Guitar",
    } as any);

    expect(presenterAfterInvite.members[0].status).toBe("pending");

    const currentUser = {
      userId: musician.musician_id.id,
      roles: ["musician"],
      establishmentIds: [],
      bandIds: [],
      isAdmin: false,
    };

    const presenterAfterAccept = await controller.acceptInvite(
      band.band_id.id,
      currentUser as any,
    );

    expect(presenterAfterAccept.members[0].status).toBe("accepted");
  });

  it("should let the invited musician decline a pending invite", async () => {
    const musician = Musician.fake()
      .aMusician()
      .withName("Invited")
      .withEmail("invited2@example.com")
      .build();
    await musicianRepository.insert(musician);

    const band = Band.fake().aBand().withName("My Band").build();
    await bandRepository.insert(band);

    await controller.addMember(band.band_id.id, {
      musician_id: musician.musician_id.id,
      role: "member",
      instrument: "Guitar",
    } as any);

    const currentUser = {
      userId: musician.musician_id.id,
      roles: ["musician"],
      establishmentIds: [],
      bandIds: [],
      isAdmin: false,
    };

    const presenterAfterDecline = await controller.declineInvite(
      band.band_id.id,
      currentUser as any,
    );

    expect(presenterAfterDecline.members[0].status).toBe("declined");
  });

  it("should set band open_to_gigs, never defaulting to true", async () => {
    const band = Band.fake().aBand().withName("My Band").build();
    await bandRepository.insert(band);

    expect(band.open_to_gigs).toBeNull();

    const presenter = await controller.setOpenToGigs(band.band_id.id, {
      open_to_gigs: true,
    } as any);

    expect(presenter.open_to_gigs).toBe(true);
  });
});
