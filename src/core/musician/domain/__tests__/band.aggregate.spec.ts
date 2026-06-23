import { Uuid } from "@core/shared/domain";

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
    });
    expect(Array.isArray(json.members)).toBe(true);
  });
});
