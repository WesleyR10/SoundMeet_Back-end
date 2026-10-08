import { ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { AcceptBandInviteUseCase } from "../../../core/musician/application/use-cases/accept-band-invite/accept-band-invite.use-case";
import { CreateBandUseCase } from "../../../core/musician/application/use-cases/create-band/create-band.use-case";
import { DeclineBandInviteUseCase } from "../../../core/musician/application/use-cases/decline-band-invite/decline-band-invite.use-case";
import { DissolveBandUseCase } from "../../../core/musician/application/use-cases/dissolve-band/dissolve-band.use-case";
import { GetBandUseCase } from "../../../core/musician/application/use-cases/get-band/get-band.use-case";
import { InviteBandMemberUseCase } from "../../../core/musician/application/use-cases/invite-band-member/invite-band-member.use-case";
import { ListBandIdentitiesUseCase } from "../../../core/musician/application/use-cases/list-band-identities/list-band-identities.use-case";
import { ListBandsUseCase } from "../../../core/musician/application/use-cases/list-bands/list-bands.use-case";
import { ListMyBandsUseCase } from "../../../core/musician/application/use-cases/list-my-bands/list-my-bands.use-case";
import { RemoveBandMemberUseCase } from "../../../core/musician/application/use-cases/remove-band-member/remove-band-member.use-case";
import { SetBandOpenToGigsUseCase } from "../../../core/musician/application/use-cases/set-band-open-to-gigs/set-band-open-to-gigs.use-case";
import { TransferBandLeadershipUseCase } from "../../../core/musician/application/use-cases/transfer-band-leadership/transfer-band-leadership.use-case";
import { UpdateBandUseCase } from "../../../core/musician/application/use-cases/update-band/update-band.use-case";
import { BandId } from "../../../core/musician/domain/band.aggregate";
import { IBandRepository } from "../../../core/musician/domain/band.repository";
import { IBandCommitmentsReader } from "../../../core/musician/domain/band-commitments.reader";
import { Musician } from "../../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../core/musician/domain/musician.repository";
import { BandCommitmentsInMemoryReader } from "../../../core/musician/infra/db/in-memory/band-commitments-in-memory.reader";
import { BandInMemoryRepository } from "../../../core/musician/infra/db/in-memory/band-in-memory.repository";
import { MusicianInMemoryRepository } from "../../../core/musician/infra/db/in-memory/musician-in-memory.repository";
import { UnauthorizedError } from "../../../core/shared/domain/errors/unauthorized.error";
import { Location } from "../../../core/shared/domain/value-objects/location.vo";
import { AuthenticatedUser } from "../../auth-module";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import {
  BandPresenter,
  DissolveBandPresenter,
  PublicBandPresenter,
} from "../band.presenter";
import { BandsController } from "../bands.controller";

const asMusician = (musician: Musician): AuthenticatedUser => ({
  userId: musician.musician_id.id,
  roles: ["musician"],
  establishmentIds: [],
  bandIds: [],
  isAdmin: false,
});

describe("BandsController Integration Tests", () => {
  let controller: BandsController;
  let bandRepository: BandInMemoryRepository;
  let musicianRepository: MusicianInMemoryRepository;
  let commitments: BandCommitmentsInMemoryReader;
  let leader: Musician;
  let other: Musician;

  beforeEach(async () => {
    const bandRepositoryInstance = new BandInMemoryRepository();
    const musicianRepositoryInstance = new MusicianInMemoryRepository();
    const commitmentsInstance = new BandCommitmentsInMemoryReader();
    const bandRepo = {
      provide: "BandRepository",
      useValue: bandRepositoryInstance,
    };
    const single = (useCase: new (repo: IBandRepository) => unknown) => ({
      provide: useCase,
      useFactory: (repo: IBandRepository) => new useCase(repo),
      inject: ["BandRepository"],
    });

    const moduleBuilder = Test.createTestingModule({
      controllers: [BandsController],
      providers: [
        bandRepo,
        { provide: "MusicianRepository", useValue: musicianRepositoryInstance },
        { provide: "BandCommitmentsReader", useValue: commitmentsInstance },
        single(CreateBandUseCase),
        single(UpdateBandUseCase),
        single(GetBandUseCase),
        single(ListBandsUseCase),
        single(ListMyBandsUseCase),
        single(ListBandIdentitiesUseCase),
        single(RemoveBandMemberUseCase),
        single(AcceptBandInviteUseCase),
        single(DeclineBandInviteUseCase),
        single(SetBandOpenToGigsUseCase),
        single(TransferBandLeadershipUseCase),
        {
          provide: DissolveBandUseCase,
          useFactory: (repo: IBandRepository, reader: IBandCommitmentsReader) =>
            new DissolveBandUseCase(repo, reader),
          inject: ["BandRepository", "BandCommitmentsReader"],
        },
        {
          provide: InviteBandMemberUseCase,
          useFactory: (repo: IBandRepository, musicians: IMusicianRepository) =>
            new InviteBandMemberUseCase(repo, musicians),
          inject: ["BandRepository", "MusicianRepository"],
        },
      ],
    });

    const module: TestingModule =
      await applyAuthGuardMocks(moduleBuilder).compile();

    controller = module.get<BandsController>(BandsController);
    bandRepository = bandRepositoryInstance;
    musicianRepository = musicianRepositoryInstance;
    commitments = commitmentsInstance;

    leader = Musician.fake().aMusician().build();
    other = Musician.fake().aMusician().build();
    await musicianRepository.bulkInsert([leader, other]);
  });

  const createBand = (over: Record<string, unknown> = {}) =>
    controller.create(
      { name: "The Rockers", genres: ["Rock"], ...over } as never,
      asMusician(leader),
    );

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(controller["createBandUseCase"]).toBeInstanceOf(CreateBandUseCase);
    expect(controller["dissolveBandUseCase"]).toBeInstanceOf(
      DissolveBandUseCase,
    );
    expect(controller["listMyBandsUseCase"]).toBeInstanceOf(ListMyBandsUseCase);
    expect(controller["listBandIdentitiesUseCase"]).toBeInstanceOf(
      ListBandIdentitiesUseCase,
    );
  });

  describe("criar", () => {
    it("quem cria vira líder aceito e recebe a banda por dentro", async () => {
      const presenter = await createBand({ description: "A rock band" });

      expect(presenter).toBeInstanceOf(BandPresenter);
      expect(presenter.members).toEqual([
        expect.objectContaining({
          musician_id: leader.musician_id.id,
          role: "leader",
          status: "accepted",
        }),
      ]);
      expect(presenter.is_active).toBe(true);
      expect(presenter.open_to_gigs).toBeNull();
      const saved = await bandRepository.findById(new BandId(presenter.id));
      expect(saved!.isLeader(leader.musician_id)).toBe(true);
    });

    it("🔴 só `musician` cria: admin lideraria com um `sub` que não é músico", () => {
      const roles = Reflect.getMetadata(
        "roles",
        BandsController.prototype.create,
      );
      expect(roles).toEqual(["musician"]);
    });
  });

  describe("🔴 ler: visão pública × visão de integrante", () => {
    const seedBandWithAddress = async () => {
      const created = await createBand();
      const band = (await bandRepository.findById(new BandId(created.id)))!;
      band.changeAddress(
        new Location({
          city: "São Paulo",
          state: "SP",
          street: "Rua das Flores",
          number: "42",
          zip_code: "01310100",
          latitude: -23.56,
          longitude: -46.65,
        }),
      );
      band.inviteMember(other.musician_id, "member", "Baixo");
      await bandRepository.update(band);
      return created.id;
    };

    it("anônimo recebe a pública: sem rua, CEP, coordenada nem convite em aberto", async () => {
      const id = await seedBandWithAddress();

      const presenter = await controller.findOne(id);

      expect(presenter).toBeInstanceOf(PublicBandPresenter);
      expect(presenter.address).toEqual({ city: "São Paulo", state: "SP" });
      // O convite pendente do `other` não é da conta de terceiros.
      expect(presenter.members.map((m) => m.musician_id)).toEqual([
        leader.musician_id.id,
      ]);
      const raw = JSON.stringify(presenter);
      for (const leak of [
        "Rua das Flores",
        "01310100",
        "-23.56",
        "responded_at",
      ]) {
        expect(raw).not.toContain(leak);
      }
    });

    it("o líder recebe a banda por dentro, com o endereço completo e os convites", async () => {
      const id = await seedBandWithAddress();

      const presenter = await controller.findOne(id, asMusician(leader));

      expect(presenter).toBeInstanceOf(BandPresenter);
      expect(presenter.address).toMatchObject({
        street: "Rua das Flores",
        zip_code: "01310100",
      });
      expect(presenter.members).toHaveLength(2);
    });

    it("convidado pendente ainda é terceiro", async () => {
      const id = await seedBandWithAddress();

      const presenter = await controller.findOne(id, asMusician(other));

      expect(presenter).toBeInstanceOf(PublicBandPresenter);
    });

    it("token recusado do próprio líder vira 401, não a versão pública", async () => {
      const id = await seedBandWithAddress();

      await expect(
        controller.findOne(id, undefined, leader.musician_id.id),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("a busca devolve a pública, só de quem está no radar", async () => {
      const id = await seedBandWithAddress();
      expect((await controller.findAll({})).data).toHaveLength(0);

      await controller.setOpenToGigs(
        id,
        { open_to_gigs: true } as never,
        asMusician(leader),
      );
      const listed = await controller.findAll({});

      expect(listed.data).toHaveLength(1);
      expect(listed.data[0]).toBeInstanceOf(PublicBandPresenter);
      expect(listed.data[0].address).toEqual({
        city: "São Paulo",
        state: "SP",
      });
    });
  });

  describe("🔴 minhas bandas — o convite pendente chega ao convidado", () => {
    it("o convidado vê o convite, com a própria linha e sem o endereço da banda", async () => {
      const created = await createBand();
      await controller.addMember(
        created.id,
        { musician_id: other.musician_id.id, instrument: "Baixo" } as never,
        asMusician(leader),
      );

      const mine = await controller.findMine(asMusician(other));

      expect(mine).toHaveLength(1);
      expect(mine[0]).toBeInstanceOf(PublicBandPresenter);
      expect(
        mine[0].members.find((m) => m.musician_id === other.musician_id.id),
      ).toMatchObject({ status: "pending", instrument: "Baixo" });
    });

    it("quem integra a banda a recebe por dentro", async () => {
      const created = await createBand();

      const mine = await controller.findMine(asMusician(leader));

      expect(mine).toHaveLength(1);
      expect(mine[0]).toBeInstanceOf(BandPresenter);
      expect(mine[0].id).toBe(created.id);
    });
  });

  describe("convite: aceitar, recusar, sair", () => {
    const invite = async () => {
      const created = await createBand();
      await controller.addMember(
        created.id,
        { musician_id: other.musician_id.id, instrument: "Baixo" } as never,
        asMusician(leader),
      );
      return created.id;
    };

    it("aceitar transforma o convidado em integrante", async () => {
      const id = await invite();

      const presenter = await controller.acceptInvite(id, asMusician(other));

      expect(presenter).toBeInstanceOf(BandPresenter);
      const saved = await bandRepository.findById(new BandId(id));
      expect(saved!.isAcceptedMember(other.musician_id)).toBe(true);
    });

    it("recusar mantém o músico de fora, e ele recebe a banda como terceiro", async () => {
      const id = await invite();

      const presenter = await controller.declineInvite(id, asMusician(other));

      expect(presenter).toBeInstanceOf(PublicBandPresenter);
      const saved = await bandRepository.findById(new BandId(id));
      expect(saved!.findMember(other.musician_id)?.status).toBe("declined");
    });

    it("🔴 o integrante sai sozinho, sem depender do líder", async () => {
      const id = await invite();
      await controller.acceptInvite(id, asMusician(other));

      await controller.removeMember(
        id,
        other.musician_id.id,
        asMusician(other),
      );

      const saved = await bandRepository.findById(new BandId(id));
      expect(saved!.findMember(other.musician_id)).toBeNull();
    });

    it("quem não é líder não convida", async () => {
      const id = await invite();
      await controller.acceptInvite(id, asMusician(other));
      const third = Musician.fake().aMusician().build();
      await musicianRepository.insert(third);

      await expect(
        controller.addMember(
          id,
          { musician_id: third.musician_id.id, instrument: "Voz" } as never,
          asMusician(other),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("atualizar", () => {
    it("🔴 `formed_in` é gravado — o controller o descartava e respondia 200", async () => {
      const created = await createBand();

      const presenter = await controller.update(
        created.id,
        { formed_in: 2015 } as never,
        asMusician(leader),
      );

      expect(presenter.formed_in).toBe(2015);
      const saved = await bandRepository.findById(new BandId(created.id));
      expect(saved!.formed_in).toBe(2015);

      const cleared = await controller.update(
        created.id,
        { formed_in: null } as never,
        asMusician(leader),
      );
      expect(cleared.formed_in).toBeNull();
    });

    it("nada do corpo sobrescreve o id da URL nem o ator do token", async () => {
      const created = await createBand();
      const stranger = Musician.fake().aMusician().build();

      await expect(
        controller.update(
          created.id,
          {
            name: "tomada",
            // Se o spread do corpo viesse depois, isto promoveria o estranho.
            requesting_musician_id: leader.musician_id.id,
            is_admin: true,
          } as never,
          asMusician(stranger),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("🔴 transferir a liderança muda quem opera a banda, na hora", () => {
    it("a nova líder passa a editar e o ex-líder deixa de poder", async () => {
      const created = await createBand();
      await controller.addMember(
        created.id,
        { musician_id: other.musician_id.id, instrument: "Baixo" } as never,
        asMusician(leader),
      );
      await controller.acceptInvite(created.id, asMusician(other));

      await controller.transferLeadership(
        created.id,
        { new_leader_musician_id: other.musician_id.id },
        asMusician(leader),
      );

      const renamed = await controller.update(
        created.id,
        { name: "da nova líder" } as never,
        asMusician(other),
      );
      expect(renamed.name).toBe("da nova líder");

      await expect(
        controller.update(
          created.id,
          { name: "do ex-líder" } as never,
          asMusician(leader),
        ),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.remove(created.id, asMusician(leader)),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("dissolver", () => {
    it("banda sem histórico é apagada", async () => {
      const created = await createBand();

      const presenter = await controller.remove(created.id, asMusician(leader));

      expect(presenter).toEqual(
        new DissolveBandPresenter({ outcome: "deleted" }),
      );
      expect(await bandRepository.findById(new BandId(created.id))).toBeNull();
    });

    it("banda com histórico é arquivada e sai da busca", async () => {
      const created = await createBand();
      await controller.setOpenToGigs(
        created.id,
        { open_to_gigs: true } as never,
        asMusician(leader),
      );
      commitments.set(new BandId(created.id), { has_history: true });

      const presenter = await controller.remove(created.id, asMusician(leader));

      expect(presenter.outcome).toBe("archived");
      expect((await controller.findAll({})).data).toHaveLength(0);
      // Continua resolvível por id: o nome aparece nos shows antigos.
      const stillThere = await controller.findOne(created.id);
      expect(stillThere.is_active).toBe(false);
    });
  });
});

/**
 * 🔴 Ordem de rota dentro do controller — mesmo guarda de
 * `MusiciansController`. `mine` e `identities` são segmentos literais e `:id`
 * é curinga: declarados depois, casariam como `findOne`, o `ParseUUIDPipe`
 * responderia 422 e "Minhas bandas" deixaria de carregar sem erro nenhum.
 */
describe("BandsController — ordem de rota", () => {
  const proto = BandsController.prototype as unknown as Record<string, any>;
  const methodOrder = () =>
    Object.getOwnPropertyNames(proto).filter(
      (name) => typeof proto[name] === "function" && name !== "constructor",
    );
  const pathOf = (method: string) =>
    Reflect.getMetadata("path", proto[method]) as string | undefined;
  const verbOf = (method: string) =>
    Reflect.getMetadata("method", proto[method]) as number | undefined;

  it.each(["findMine", "findIdentities"])(
    "declara %s ANTES de findOne",
    (method) => {
      const order = methodOrder();

      expect(order.indexOf(method)).toBeGreaterThanOrEqual(0);
      expect(order.indexOf(method)).toBeLessThan(order.indexOf("findOne"));
    },
  );

  it("os handlers continuam nos caminhos que este teste assume", () => {
    expect(pathOf("findMine")).toBe("mine");
    expect(pathOf("findIdentities")).toBe("identities");
    expect(pathOf("findOne")).toBe(":id");
  });

  it("nenhum segmento literal de GET nasce depois de :id", () => {
    const order = methodOrder();
    const findOneIndex = order.indexOf("findOne");
    // RequestMethod.GET === 0
    const literalGetsAfter = order
      .slice(findOneIndex + 1)
      .filter((name) => verbOf(name) === 0)
      .filter((name) => {
        const path = pathOf(name) ?? "";
        return path !== "" && !path.startsWith(":");
      });

    expect(literalGetsAfter).toEqual([]);
  });

  it("nenhuma rota de escrita ficou pública", () => {
    const publicWrites = methodOrder().filter(
      (name) =>
        verbOf(name) !== undefined &&
        verbOf(name) !== 0 &&
        Reflect.getMetadata("isPublic", proto[name]) === true,
    );

    expect(publicWrites).toEqual([]);
  });
});
