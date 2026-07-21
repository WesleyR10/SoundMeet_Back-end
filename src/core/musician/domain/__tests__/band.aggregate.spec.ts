import { Uuid } from "@core/shared/domain";

import { Location } from "../../../shared/domain/value-objects/location.vo";
import { Band, BandId } from "../band.aggregate";

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

  test("should add and remove member", () => {
    const band = Band.create({
      name: "Band Name",
      genres: ["rock"],
    });
    const musicianId = new Uuid();

    band.addMember(musicianId, "leader", "guitar");
    expect(band.members).toHaveLength(1);
    expect(band.members[0].musician_id.id).toBe(musicianId.id);

    band.removeMember(musicianId);
    expect(band.members).toHaveLength(0);
  });

  test("should not add duplicate member", () => {
    const band = Band.create({
      name: "Band Name",
      genres: ["rock"],
    });
    const musicianId = new Uuid();

    band.addMember(musicianId, "leader", "guitar");
    band.addMember(musicianId, "member", "bass");

    expect(band.notification.hasErrors()).toBe(true);
    expect(band.notification).notificationContainsErrorMessages([
      { musician_id: ["Musician is already a member of this band"] },
    ]);
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

  test("should update member role", () => {
    const band = Band.create({
      name: "Band Name",
      genres: ["rock"],
    });
    const musicianId = new Uuid();

    band.addMember(musicianId, "member", "guitar");
    band.updateMemberRole(musicianId, "leader");

    expect(band.members[0].role).toBe("leader");
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
});
