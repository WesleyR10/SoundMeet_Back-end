import { Uuid } from "@core/shared/domain";

import { Location } from "../../../shared/domain/value-objects/location.vo";
import { Band, BandId } from "../band.aggregate";
import { parseBandMemberRole } from "../band-member-role";

describe("Band Unit Tests", () => {
  beforeEach(() => {
    Band.prototype.validate = jest
      .fn()
      .mockImplementation(Band.prototype.validate);
  });

  test("constructor of band", () => {
    const band = new Band({
      name: "Band Name",
      genres: ["rock"],
    });

    expect(band.band_id).toBeInstanceOf(BandId);
    expect(band.name).toBe("Band Name");
    expect(band.description).toBeNull();
    expect(band.avatar).toBeNull();
    expect(band.genres).toEqual(["rock"]);
    // Ausente por default: banda recém-criada não declarou o ano, e `null` é
    // o estado honesto disso — nunca um número derivado de `created_at`.
    expect(band.formed_in).toBeNull();
    expect(band.members).toEqual([]);
    expect(band.priceRange).toBeNull();
    expect(band.is_active).toBe(true);
    expect(band.created_at).toBeInstanceOf(Date);
    expect(band.updated_at).toBeInstanceOf(Date);
  });

  describe("create command", () => {
    test("should create a band", () => {
      const band = Band.create({
        name: "Band Name",
        genres: ["rock", "pop"],
      });

      expect(band.band_id).toBeInstanceOf(BandId);
      expect(band.name).toBe("Band Name");
      expect(band.genres).toEqual(["rock", "pop"]);
      expect(Band.prototype.validate).toHaveBeenCalledTimes(1);
      expect(band.notification.hasErrors()).toBe(false);
    });
  });

  test("should change name", () => {
    const band = Band.create({
      name: "Band Name",
      genres: ["rock"],
    });

    band.changeName("New Name");
    expect(band.name).toBe("New Name");
    expect(Band.prototype.validate).toHaveBeenCalled();
  });

  test("should remove a member", () => {
    const band = Band.create({
      name: "Band Name",
      genres: ["rock"],
    });
    const musicianId = new Uuid();

    band.inviteMember(musicianId, "member", "guitar");
    band.acceptInvite(musicianId);
    expect(band.members).toHaveLength(1);
    expect(band.members[0].musician_id.id).toBe(musicianId.id);

    band.removeMember(musicianId);
    expect(band.members).toHaveLength(0);
  });

  test("should error when removing missing member", () => {
    const band = Band.create({
      name: "Band Name",
      genres: ["rock"],
    });

    band.removeMember(new Uuid());

    expect(band.notification.hasErrors()).toBe(true);
    expect(band.notification).notificationContainsErrorMessages([
      { musician_id: ["Musician is not a member of this band"] },
    ]);
  });

  test("should return json", () => {
    const band = Band.create({
      name: "Band Name",
      genres: ["rock"],
    });

    const json = band.toJSON();
    expect(json).toMatchObject({
      band_id: band.band_id.id,
      name: band.name,
      genres: band.genres,
      is_active: band.is_active,
      address: null,
      open_to_gigs: null,
    });
    expect(Array.isArray(json.members)).toBe(true);
  });

  describe("invite flow", () => {
    test("inviteMember creates a pending member", () => {
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      const musicianId = new Uuid();

      band.inviteMember(musicianId, "member", "guitar");

      expect(band.notification.hasErrors()).toBe(false);
      expect(band.members).toHaveLength(1);
      expect(band.members[0].status).toBe("pending");
      expect(band.members[0].responded_at).toBeNull();
      expect(band.acceptedMembers).toHaveLength(0);
    });

    test("inviteMember errors when musician already has a member/invite", () => {
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      const musicianId = new Uuid();

      band.inviteMember(musicianId, "member", "guitar");
      band.inviteMember(musicianId, "member", "bass");

      expect(band.notification.hasErrors()).toBe(true);
      expect(band.notification).notificationContainsErrorMessages([
        {
          musician_id: [
            "Musician is already a member or has a pending invite for this band",
          ],
        },
      ]);
    });

    test("acceptInvite transitions pending to accepted", () => {
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      const musicianId = new Uuid();
      band.inviteMember(musicianId, "member", "guitar");

      band.acceptInvite(musicianId);

      expect(band.notification.hasErrors()).toBe(false);
      expect(band.members[0].status).toBe("accepted");
      expect(band.members[0].responded_at).toBeInstanceOf(Date);
      expect(band.acceptedMembers).toHaveLength(1);
    });

    test("declineInvite transitions pending to declined", () => {
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      const musicianId = new Uuid();
      band.inviteMember(musicianId, "member", "guitar");

      band.declineInvite(musicianId);

      expect(band.notification.hasErrors()).toBe(false);
      expect(band.members[0].status).toBe("declined");
      expect(band.members[0].responded_at).toBeInstanceOf(Date);
      expect(band.acceptedMembers).toHaveLength(0);
    });

    test("acceptInvite errors when there is no invite for the musician", () => {
      const band = Band.create({ name: "Band Name", genres: ["rock"] });

      band.acceptInvite(new Uuid());

      expect(band.notification.hasErrors()).toBe(true);
      expect(band.notification).notificationContainsErrorMessages([
        { musician_id: ["No invite found for this musician"] },
      ]);
    });

    test("acceptInvite errors when invite is not pending anymore", () => {
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      const musicianId = new Uuid();
      band.inviteMember(musicianId, "member", "guitar");
      band.acceptInvite(musicianId);

      band.acceptInvite(musicianId);

      expect(band.notification.hasErrors()).toBe(true);
      expect(band.notification).notificationContainsErrorMessages([
        { status: ["Invite is not pending"] },
      ]);
    });

    test("declineInvite errors when invite is not pending anymore", () => {
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      const musicianId = new Uuid();
      band.inviteMember(musicianId, "member", "guitar");
      band.declineInvite(musicianId);

      band.declineInvite(musicianId);

      expect(band.notification.hasErrors()).toBe(true);
      expect(band.notification).notificationContainsErrorMessages([
        { status: ["Invite is not pending"] },
      ]);
    });

    test("acceptedMembers filters only accepted members", () => {
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      const pendingMusician = new Uuid();
      const acceptedMusician = new Uuid();
      const declinedMusician = new Uuid();

      band.inviteMember(pendingMusician, "member", "guitar");
      band.inviteMember(acceptedMusician, "member", "bass");
      band.inviteMember(declinedMusician, "member", "drums");
      band.acceptInvite(acceptedMusician);
      band.declineInvite(declinedMusician);

      expect(band.acceptedMembers).toHaveLength(1);
      expect(band.acceptedMembers[0].musician_id.id).toBe(acceptedMusician.id);
    });

    // isLeader é o que separa "represento a banda" de "decido pela banda" —
    // aceitar/recusar convite e confirmar/cancelar booking passam por aqui.
    describe("isLeader", () => {
      const withLeader = (status: "accepted" | "pending", leader: Uuid) =>
        new Band({
          name: "Band Name",
          genres: ["rock"],
          members: [
            {
              musician_id: leader,
              role: "leader",
              instrument: "guitar",
              status,
              joined_at: new Date(),
              responded_at: status === "accepted" ? new Date() : null,
            },
          ],
        });

      test("recognizes the accepted leader", () => {
        const leader = new Uuid();
        expect(withLeader("accepted", leader).isLeader(leader)).toBe(true);
      });

      test("a plain member is not a leader", () => {
        const band = Band.create({ name: "Band Name", genres: ["rock"] });
        const member = new Uuid();
        band.inviteMember(member, "member", "bass");
        band.acceptInvite(member);

        expect(band.isLeader(member)).toBe(false);
      });

      test("a leader with a pending invite does not lead yet", () => {
        const leader = new Uuid();
        expect(withLeader("pending", leader).isLeader(leader)).toBe(false);
      });

      test("an outsider is never a leader", () => {
        expect(withLeader("accepted", new Uuid()).isLeader(new Uuid())).toBe(
          false,
        );
      });
    });

    test("inviteMember reactivates a previously declined invite instead of rejecting it forever", () => {
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      const musicianId = new Uuid();

      band.inviteMember(musicianId, "member", "guitar");
      band.declineInvite(musicianId);
      expect(band.members[0].status).toBe("declined");

      band.inviteMember(musicianId, "member", "bass");

      expect(band.notification.hasErrors()).toBe(false);
      expect(band.members).toHaveLength(1);
      expect(band.members[0].status).toBe("pending");
      expect(band.members[0].instrument).toBe("bass");
      expect(band.members[0].responded_at).toBeNull();
    });

    test("inviteMember still rejects a musician who is already pending", () => {
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      const musicianId = new Uuid();
      band.inviteMember(musicianId, "member", "guitar");

      band.inviteMember(musicianId, "member", "guitar");

      expect(band.notification.hasErrors()).toBe(true);
      expect(band.members).toHaveLength(1);
    });

    test("inviteMember still rejects a musician who is already accepted", () => {
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      const musicianId = new Uuid();
      band.inviteMember(musicianId, "member", "bass");
      band.acceptInvite(musicianId);

      band.inviteMember(musicianId, "member", "bass");

      expect(band.notification.hasErrors()).toBe(true);
      expect(band.members).toHaveLength(1);
      expect(band.members[0].status).toBe("accepted");
    });
  });

  /**
   * A banda tem no máximo um líder aceito, e ele é o único que decide por ela.
   * Antes disso `role` era String livre e nada impedia dois líderes (ou zero,
   * removendo o único que havia) — a banda ficava sem quem aceitasse show.
   */
  describe("single leader invariant", () => {
    const bandWithLeader = () => {
      const leader = new Uuid();
      const band = new Band({
        name: "Band Name",
        genres: ["rock"],
        members: [
          {
            musician_id: leader,
            role: "leader",
            instrument: "guitar",
            status: "accepted",
            joined_at: new Date(),
            responded_at: new Date(),
          },
        ],
      });
      return { band, leader };
    };

    const withAcceptedMember = (band: Band) => {
      const member = new Uuid();
      band.inviteMember(member, "member", "bass");
      band.acceptInvite(member);
      return member;
    };

    describe("role parsing", () => {
      test("normalizes casing and whitespace so a leader never loses their own decisions", () => {
        expect(parseBandMemberRole(" LEADER ")).toBe("leader");
        expect(parseBandMemberRole("Member")).toBe("member");
      });

      test("rejects anything outside the closed set", () => {
        expect(parseBandMemberRole("vocalista")).toBeNull();
        expect(parseBandMemberRole("")).toBeNull();
        expect(parseBandMemberRole(undefined)).toBeNull();
      });

      test("an unknown role decays to member — never promotes by accident", () => {
        const band = new Band({
          name: "Band Name",
          genres: ["rock"],
          members: [
            {
              musician_id: new Uuid(),
              role: "vocalista" as never,
              instrument: "voz",
              status: "accepted",
              joined_at: new Date(),
              responded_at: new Date(),
            },
          ],
        });

        expect(band.members[0].role).toBe("member");
        expect(band.leader).toBeNull();
      });

      test("a leader stored as 'Leader' is still recognized as the leader", () => {
        const musician_id = new Uuid();
        const band = new Band({
          name: "Band Name",
          genres: ["rock"],
          members: [
            {
              musician_id,
              role: "Leader" as never,
              instrument: "guitar",
              status: "accepted",
              joined_at: new Date(),
              responded_at: new Date(),
            },
          ],
        });

        expect(band.isLeader(musician_id)).toBe(true);
      });
    });

    describe("no second leader", () => {
      test("inviteMember refuses to invite a second leader", () => {
        const { band } = bandWithLeader();

        band.inviteMember(new Uuid(), "leader", "bass");

        expect(band.notification.hasErrors()).toBe(true);
        expect(band.members).toHaveLength(1);
      });

      // O convite pode ter sido emitido antes de alguém assumir a liderança.
      test("accepting a stale leader invite does not create a second leader", () => {
        const band = Band.create({ name: "Band Name", genres: ["rock"] });
        const first = new Uuid();
        const second = new Uuid();

        band.inviteMember(first, "leader", "guitar");
        band.inviteMember(second, "leader", "bass");
        // O segundo convite passa porque ainda não há líder ACEITO.
        expect(band.members).toHaveLength(2);

        band.acceptInvite(first);
        band.acceptInvite(second);

        expect(band.notification.hasErrors()).toBe(true);
        expect(band.leader?.musician_id.equals(first)).toBe(true);
        expect(band.members[1].status).toBe("pending");
      });
    });

    describe("no headless band", () => {
      test("removeMember refuses to remove the leader while others remain", () => {
        const { band, leader } = bandWithLeader();
        withAcceptedMember(band);

        band.removeMember(leader);

        expect(band.notification.hasErrors()).toBe(true);
        expect(band.isLeader(leader)).toBe(true);
      });

      // Sair sendo o último não deixa banda acéfala: deixa banda vazia, e o
      // caso de uso correto passa a ser deletá-la.
      test("removeMember allows the leader to leave when they are the last member", () => {
        const { band, leader } = bandWithLeader();

        band.removeMember(leader);

        expect(band.notification.hasErrors()).toBe(false);
        expect(band.members).toHaveLength(0);
      });
    });

    describe("transferLeadership", () => {
      test("demotes and promotes in one step — never two leaders, never zero", () => {
        const { band, leader } = bandWithLeader();
        const successor = withAcceptedMember(band);

        band.transferLeadership(leader, successor);

        expect(band.notification.hasErrors()).toBe(false);
        expect(band.isLeader(successor)).toBe(true);
        expect(band.isLeader(leader)).toBe(false);
        expect(band.members.filter((m) => m.role === "leader")).toHaveLength(1);
      });

      test("only the current leader can transfer", () => {
        const { band } = bandWithLeader();
        const member = withAcceptedMember(band);
        const other = withAcceptedMember(band);

        band.transferLeadership(member, other);

        expect(band.notification.hasErrors()).toBe(true);
        expect(band.isLeader(other)).toBe(false);
      });

      test("the successor must already be a member", () => {
        const { band, leader } = bandWithLeader();

        band.transferLeadership(leader, new Uuid());

        expect(band.notification.hasErrors()).toBe(true);
        expect(band.isLeader(leader)).toBe(true);
      });

      test("a pending invitee cannot take over", () => {
        const { band, leader } = bandWithLeader();
        const pending = new Uuid();
        band.inviteMember(pending, "member", "drums");

        band.transferLeadership(leader, pending);

        expect(band.notification.hasErrors()).toBe(true);
        expect(band.isLeader(leader)).toBe(true);
      });

      test("transferring to oneself is rejected", () => {
        const { band, leader } = bandWithLeader();

        band.transferLeadership(leader, leader);

        expect(band.notification.hasErrors()).toBe(true);
        expect(band.isLeader(leader)).toBe(true);
      });

      // Depois de transferir, o ex-líder pode sair normalmente.
      test("the former leader can be removed after handing over", () => {
        const { band, leader } = bandWithLeader();
        const successor = withAcceptedMember(band);

        band.transferLeadership(leader, successor);
        band.removeMember(leader);

        expect(band.notification.hasErrors()).toBe(false);
        expect(band.members).toHaveLength(1);
        expect(band.isLeader(successor)).toBe(true);
      });
    });
  });

  describe("open_to_gigs and address", () => {
    test("setOpenToGigs updates the consent flag", () => {
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      expect(band.open_to_gigs).toBeNull();

      band.setOpenToGigs(true);
      expect(band.open_to_gigs).toBe(true);

      band.setOpenToGigs(false);
      expect(band.open_to_gigs).toBe(false);
    });

    test("changeAddress updates and clears the address", () => {
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      const address = new Location({ city: "São Paulo", state: "SP" });

      band.changeAddress(address);
      expect(band.address).toBe(address);

      band.changeAddress(null);
      expect(band.address).toBeNull();
    });
  });

  describe("formed_in — tempo de estrada da banda", () => {
    test("nasce null e aceita o ano declarado", () => {
      const band = Band.create({ name: "Os Bons", genres: ["rock"] });
      expect(band.formed_in).toBeNull();

      band.changeFormedIn(2019);
      expect(band.formed_in).toBe(2019);
      expect(band.notification.hasErrors()).toBe(false);
    });

    test("aceita null de volta — desinformar é operação legítima", () => {
      const band = Band.create({
        name: "Os Bons",
        genres: ["rock"],
        formed_in: 2019,
      });
      expect(band.formed_in).toBe(2019);

      band.changeFormedIn(null);
      expect(band.formed_in).toBeNull();
      expect(band.notification.hasErrors()).toBe(false);
    });

    test("🔴 create com ano no futuro acumula erro de validação", () => {
      const band = Band.create({
        name: "Os Bons",
        genres: ["rock"],
        formed_in: new Date().getFullYear() + 1,
      });

      expect(band.notification.hasErrors()).toBe(true);
      expect(band.notification.toJSON()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ formed_in: expect.anything() }),
        ]),
      );
    });

    test("atualiza updated_at", () => {
      const band = Band.create({ name: "Os Bons", genres: ["rock"] });
      const before = band.updated_at;

      band.changeFormedIn(2019);
      expect(band.updated_at.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });
  });

  describe("🔴 integrantes são comparados pelo ID, não pela classe do value object", () => {
    // É a forma que o dado tem depois de uma ida ao banco: o mapper do Prisma
    // monta os integrantes com `Uuid`, e os use-cases chegam com uma subclasse
    // (`MusicianId`). `ValueObject.equals` exige a MESMA classe — com ele,
    // nada abaixo casava e aceitar/recusar/remover respondiam 422 em produção.
    class MusicianIdLike extends Uuid {}

    const loadedBand = (
      id: string,
      status: "pending" | "accepted",
      role: "leader" | "member" = "member",
    ) =>
      new Band({
        name: "Band Name",
        genres: ["rock"],
        members: [
          {
            musician_id: new Uuid(id),
            role,
            instrument: "guitar",
            status,
            joined_at: new Date(),
            responded_at: null,
          },
        ],
      });

    test("aceitar convite", () => {
      const id = new Uuid().id;
      const band = loadedBand(id, "pending");

      band.acceptInvite(new MusicianIdLike(id));

      expect(band.notification.hasErrors()).toBe(false);
      expect(band.members[0].status).toBe("accepted");
    });

    test("recusar convite", () => {
      const id = new Uuid().id;
      const band = loadedBand(id, "pending");

      band.declineInvite(new MusicianIdLike(id));

      expect(band.notification.hasErrors()).toBe(false);
      expect(band.members[0].status).toBe("declined");
    });

    test("remover integrante", () => {
      const id = new Uuid().id;
      const band = loadedBand(id, "accepted");

      band.removeMember(new MusicianIdLike(id));

      expect(band.notification.hasErrors()).toBe(false);
      expect(band.members).toHaveLength(0);
    });

    test("convidar quem já está na banda é barrado aqui, não na constraint do banco", () => {
      const id = new Uuid().id;
      const band = loadedBand(id, "accepted");

      band.inviteMember(new MusicianIdLike(id), "member", "bass");

      expect(band.notification.hasErrors()).toBe(true);
      expect(band.members).toHaveLength(1);
    });

    test("isLeader, findMember e isAcceptedMember", () => {
      const id = new Uuid().id;
      const band = loadedBand(id, "accepted", "leader");

      expect(band.isLeader(new MusicianIdLike(id))).toBe(true);
      expect(band.findMember(new MusicianIdLike(id))).not.toBeNull();
      expect(band.isAcceptedMember(new MusicianIdLike(id))).toBe(true);
    });
  });

  describe("archive — banda dissolvida com histórico", () => {
    test("sai do radar, fica inativa e descarta os convites que não viraram vínculo", () => {
      const leader = new Uuid();
      const member = new Uuid();
      const pending = new Uuid();
      const declined = new Uuid();
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      band.inviteMember(leader, "leader", "guitar");
      band.acceptInvite(leader);
      band.inviteMember(member, "member", "bass");
      band.acceptInvite(member);
      band.inviteMember(pending, "member", "drums");
      band.inviteMember(declined, "member", "keys");
      band.declineInvite(declined);
      band.setOpenToGigs(true);

      band.archive();

      expect(band.is_active).toBe(false);
      expect(band.isArchived).toBe(true);
      expect(band.open_to_gigs).toBe(false);
      expect(band.members.map((m) => m.musician_id.id)).toEqual([
        leader.id,
        member.id,
      ]);
      // Quem liderava continua sendo quem responde pelo histórico.
      expect(band.isLeader(leader)).toBe(true);
    });

    test("banda nova não nasce arquivada", () => {
      const band = Band.create({ name: "Band Name", genres: ["rock"] });

      expect(band.isArchived).toBe(false);
    });
  });

  describe("eventos do convite", () => {
    const eventNames = (band: Band) =>
      band.getUncommittedEvents().map((event) => event.constructor.name);

    test("convidar, aceitar e recusar emitem um evento cada", () => {
      const leader = new Uuid();
      const accepts = new Uuid();
      const declines = new Uuid();
      const band = new Band({
        name: "Band Name",
        genres: ["rock"],
        members: [
          {
            musician_id: leader,
            role: "leader",
            instrument: "guitar",
            status: "accepted",
            joined_at: new Date(),
            responded_at: new Date(),
          },
        ],
      });

      band.inviteMember(accepts, "member", "bass");
      band.inviteMember(declines, "member", "drums");
      band.acceptInvite(accepts);
      band.declineInvite(declines);

      expect(eventNames(band)).toEqual([
        "BandMemberInvitedEvent",
        "BandMemberInvitedEvent",
        "BandInviteAcceptedEvent",
        "BandInviteDeclinedEvent",
      ]);
      const [, , accepted] = band.getUncommittedEvents() as any[];
      expect(accepted.leader_musician_id).toBe(leader.id);
      expect(accepted.musician_id).toBe(accepts.id);
    });

    test("convite recusado pelo agregado não emite evento", () => {
      const musician = new Uuid();
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      band.inviteMember(musician, "member", "bass");

      // Já tem convite pendente: o segundo é recusado.
      band.inviteMember(musician, "member", "drums");

      expect(eventNames(band)).toEqual(["BandMemberInvitedEvent"]);
    });

    test("reconvidar quem recusou emite o convite de novo", () => {
      const musician = new Uuid();
      const band = Band.create({ name: "Band Name", genres: ["rock"] });
      band.inviteMember(musician, "member", "bass");
      band.declineInvite(musician);

      band.inviteMember(musician, "member", "drums");

      expect(eventNames(band)).toEqual([
        "BandMemberInvitedEvent",
        "BandInviteDeclinedEvent",
        "BandMemberInvitedEvent",
      ]);
    });
  });
});
