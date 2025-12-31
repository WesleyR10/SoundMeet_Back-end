import { Chance } from "chance";

import { Email } from "../../../shared/domain/value-objects/email.vo";
import { QRCode } from "../../../shared/domain/value-objects/qr-code.vo";
import { Rating } from "../../../shared/domain/value-objects/rating.vo";
import { MusicianId } from "../musician.aggregate";
import { MusicianFakeBuilder } from "../musician-fake.builder";

describe("MusicianFakeBuilder Unit Tests", () => {
  describe("id prop", () => {
    const faker = MusicianFakeBuilder.aMusician();

    test("should throw error when any with methods has called", () => {
      expect(() => faker.id).toThrowError(
        new Error("Property id not have a factory, use 'with' methods"),
      );
    });

    test("should be undefined", () => {
      expect(faker["_id"]).toBeUndefined();
    });

    test("withMusicianId", () => {
      const id = new MusicianId();
      const $this = faker.withMusicianId(id);
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_id"]).toBe(id);

      faker.withMusicianId(() => id);
      //@ts-expect-error _id is a callable
      expect(faker["_id"]()).toBe(id);

      expect(faker.id).toBe(id);
    });

    test("should pass index to id factory", () => {
      faker.withMusicianId((index) => new MusicianId());
      const musician = faker.build();
      expect(musician.id).toBeInstanceOf(MusicianId);

      const fakerMany = MusicianFakeBuilder.theMusicians(2);
      fakerMany.withMusicianId((index) => new MusicianId());
      const musicians = fakerMany.build();

      expect(musicians[0].id).toBeInstanceOf(MusicianId);
      expect(musicians[1].id).toBeInstanceOf(MusicianId);
      expect(musicians[0].id).not.toBe(musicians[1].id);
    });
  });

  describe("name prop", () => {
    const faker = MusicianFakeBuilder.aMusician();
    test("should be a function", () => {
      expect(typeof faker["_name"]).toBe("function");
    });

    test("should call the word method", () => {
      const chance = Chance();
      const spyWordMethod = jest.spyOn(chance, "word");
      faker["chance"] = chance;
      faker.build();

      expect(spyWordMethod).toHaveBeenCalled();
    });

    test("withName", () => {
      const $this = faker.withName("test name");
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_name"]).toBe("test name");

      faker.withName(() => "test name");
      //@ts-expect-error name is callable
      expect(faker["_name"]()).toBe("test name");

      expect(faker.name).toBe("test name");
    });

    test("should pass index to name factory", () => {
      faker.withName((index) => `test name ${index}`);
      const musician = faker.build();
      expect(musician.name).toBe("test name 0");

      const fakerMany = MusicianFakeBuilder.theMusicians(2);
      fakerMany.withName((index) => `test name ${index}`);
      const musicians = fakerMany.build();
      expect(musicians[0].name).toBe("test name 0");
      expect(musicians[1].name).toBe("test name 1");
    });

    test("invalid too long case", () => {
      const $this = faker.withInvalidNameTooLong();
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_name"].length).toBe(256);

      const tooLong = "a".repeat(256);
      faker.withInvalidNameTooLong(tooLong);
      expect(faker["_name"]).toBe(tooLong);
    });
  });

  describe("email prop", () => {
    const faker = MusicianFakeBuilder.aMusician();
    test("should be a function", () => {
      expect(typeof faker["_email"]).toBe("function");
    });

    test("withEmail", () => {
      const $this = faker.withEmail("test@example.com");
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_email"]).toBe("test@example.com");

      faker.withEmail(() => "test@example.com");
      //@ts-expect-error email is callable
      expect(faker["_email"]()).toBe("test@example.com");

      expect(faker.email).toBe("test@example.com");
    });

    test("should pass index to email factory", () => {
      faker.withEmail((index) => `test${index}@example.com`);
      const musician = faker.build();
      expect(musician.email.value).toBe("test0@example.com");

      const fakerMany = MusicianFakeBuilder.theMusicians(2);
      fakerMany.withEmail((index) => `test${index}@example.com`);
      const musicians = fakerMany.build();
      expect(musicians[0].email.value).toBe("test0@example.com");
      expect(musicians[1].email.value).toBe("test1@example.com");
    });

    test("invalid not an email case", () => {
      const $this = faker.withInvalidEmailFormat();
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_email"]).toBe("invalid-email");

      faker.withInvalidEmailFormat("another-invalid");
      expect(faker["_email"]).toBe("another-invalid");
    });
  });

  describe("stage_name prop", () => {
    const faker = MusicianFakeBuilder.aMusician();
    test("should be a function", () => {
      expect(typeof faker["_stage_name"]).toBe("function");
    });

    test("withStageName", () => {
      const $this = faker.withStageName("Rock Star");
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_stage_name"]).toBe("Rock Star");

      faker.withStageName(() => "Rock Star");
      //@ts-expect-error stage_name is callable
      expect(faker["_stage_name"]()).toBe("Rock Star");

      expect(faker.stage_name).toBe("Rock Star");
    });

    test("should pass index to stage_name factory", () => {
      faker.withStageName((index) => `Rock Star ${index}`);
      const musician = faker.build();
      expect(musician.stage_name).toBe("Rock Star 0");

      const fakerMany = MusicianFakeBuilder.theMusicians(2);
      fakerMany.withStageName((index) => `Rock Star ${index}`);
      const musicians = fakerMany.build();
      expect(musicians[0].stage_name).toBe("Rock Star 0");
      expect(musicians[1].stage_name).toBe("Rock Star 1");
    });

    test("invalid too long case", () => {
      const $this = faker.withInvalidStageNameTooLong();
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect((faker["_stage_name"] as string).length).toBe(256);

      const tooLong = "a".repeat(256);
      faker.withInvalidStageNameTooLong(tooLong);
      expect(faker["_stage_name"]).toBe(tooLong);
    });
  });

  describe("bio prop", () => {
    const faker = MusicianFakeBuilder.aMusician();
    test("should be a function", () => {
      expect(typeof faker["_bio"]).toBe("function");
    });

    test("withBio", () => {
      const $this = faker.withBio("Professional musician");
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_bio"]).toBe("Professional musician");

      faker.withBio(() => "Professional musician");
      //@ts-expect-error bio is callable
      expect(faker["_bio"]()).toBe("Professional musician");

      expect(faker.bio).toBe("Professional musician");
    });

    test("should pass index to bio factory", () => {
      faker.withBio((index) => `Bio ${index}`);
      const musician = faker.build();
      expect(musician.bio).toBe("Bio 0");

      const fakerMany = MusicianFakeBuilder.theMusicians(2);
      fakerMany.withBio((index) => `Bio ${index}`);
      const musicians = fakerMany.build();
      expect(musicians[0].bio).toBe("Bio 0");
      expect(musicians[1].bio).toBe("Bio 1");
    });

    test("invalid too long case", () => {
      const $this = faker.withInvalidBioTooLong();
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect((faker["_bio"] as string).length).toBe(1001);

      const tooLong = "a".repeat(1001);
      faker.withInvalidBioTooLong(tooLong);
      expect(faker["_bio"]).toBe(tooLong);
    });
  });

  describe("avatar prop", () => {
    const faker = MusicianFakeBuilder.aMusician();
    test("should be a function", () => {
      expect(typeof faker["_avatar"]).toBe("function");
    });

    test("withAvatar", () => {
      const $this = faker.withAvatar("https://example.com/avatar.jpg");
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_avatar"]).toBe("https://example.com/avatar.jpg");

      faker.withAvatar(() => "https://example.com/avatar.jpg");
      //@ts-expect-error avatar is callable
      expect(faker["_avatar"]()).toBe("https://example.com/avatar.jpg");

      expect(faker.avatar).toBe("https://example.com/avatar.jpg");
    });

    test("should pass index to avatar factory", () => {
      faker.withAvatar((index) => `https://example.com/avatar${index}.jpg`);
      const musician = faker.build();
      expect(musician.avatar).toBe("https://example.com/avatar0.jpg");

      const fakerMany = MusicianFakeBuilder.theMusicians(2);
      fakerMany.withAvatar((index) => `https://example.com/avatar${index}.jpg`);
      const musicians = fakerMany.build();
      expect(musicians[0].avatar).toBe("https://example.com/avatar0.jpg");
      expect(musicians[1].avatar).toBe("https://example.com/avatar1.jpg");
    });
  });

  describe("phone prop", () => {
    const faker = MusicianFakeBuilder.aMusician();
    test("should be a function", () => {
      expect(typeof faker["_phone"]).toBe("function");
    });

    test("withPhone", () => {
      const $this = faker.withPhone("+5511999999999");
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_phone"]).toBe("+5511999999999");

      faker.withPhone(() => "+5511999999999");
      //@ts-expect-error phone is callable
      expect(faker["_phone"]()).toBe("+5511999999999");

      expect(faker.phone).toBe("+5511999999999");
    });

    test("should pass index to phone factory", () => {
      faker.withPhone((index) => `+551199999999${index}`);
      const musician = faker.build();
      expect(musician.phone?.value).toBe("+5511999999990");

      const fakerMany = MusicianFakeBuilder.theMusicians(2);
      fakerMany.withPhone((index) => `+551199999999${index}`);
      const musicians = fakerMany.build();
      expect(musicians[0].phone?.value).toBe("+5511999999990");
      expect(musicians[1].phone?.value).toBe("+5511999999991");
    });
  });

  describe("genres prop", () => {
    const faker = MusicianFakeBuilder.aMusician();
    test("should be a function", () => {
      expect(typeof faker["_genres"]).toBe("function");
    });

    test("withGenres", () => {
      const $this = faker.withGenres(["Rock", "Pop"]);
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_genres"]).toEqual(["Rock", "Pop"]);

      faker.withGenres(() => ["Rock", "Pop"]);
      //@ts-expect-error genres is callable
      expect(faker["_genres"]()).toEqual(["Rock", "Pop"]);

      expect(faker.genres).toEqual(["Rock", "Pop"]);
    });

    test("should pass index to genres factory", () => {
      faker.withGenres((index) => [`Genre${index}`]);
      const musician = faker.build();
      expect(musician.genres).toEqual(["Genre0"]);

      const fakerMany = MusicianFakeBuilder.theMusicians(2);
      fakerMany.withGenres((index) => [`Genre${index}`]);
      const musicians = fakerMany.build();
      expect(musicians[0].genres).toEqual(["Genre0"]);
      expect(musicians[1].genres).toEqual(["Genre1"]);
    });

    test("invalid empty case", () => {
      const $this = faker.withInvalidGenresEmpty();
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_genres"]).toEqual([]);
    });
  });

  describe("instruments prop", () => {
    const faker = MusicianFakeBuilder.aMusician();
    test("should be a function", () => {
      expect(typeof faker["_instruments"]).toBe("function");
    });

    test("withInstruments", () => {
      const $this = faker.withInstruments(["Guitar", "Piano"]);
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_instruments"]).toEqual(["Guitar", "Piano"]);

      faker.withInstruments(() => ["Guitar", "Piano"]);
      //@ts-expect-error instruments is callable
      expect(faker["_instruments"]()).toEqual(["Guitar", "Piano"]);

      expect(faker.instruments).toEqual(["Guitar", "Piano"]);
    });

    test("should pass index to instruments factory", () => {
      faker.withInstruments((index) => [`Instrument${index}`]);
      const musician = faker.build();
      expect(musician.instruments).toEqual(["Instrument0"]);

      const fakerMany = MusicianFakeBuilder.theMusicians(2);
      fakerMany.withInstruments((index) => [`Instrument${index}`]);
      const musicians = fakerMany.build();
      expect(musicians[0].instruments).toEqual(["Instrument0"]);
      expect(musicians[1].instruments).toEqual(["Instrument1"]);
    });

    test("invalid empty case", () => {
      const $this = faker.withInvalidInstrumentsEmpty();
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_instruments"]).toEqual([]);
    });
  });

  describe("experience_years prop", () => {
    const faker = MusicianFakeBuilder.aMusician();
    test("should be a function", () => {
      expect(typeof faker["_experience_years"]).toBe("function");
    });

    test("withExperienceYears", () => {
      const $this = faker.withExperienceYears(5);
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_experience_years"]).toBe(5);

      faker.withExperienceYears(() => 5);
      //@ts-expect-error experience_years is callable
      expect(faker["_experience_years"]()).toBe(5);

      expect(faker.experience_years).toBe(5);
    });

    test("should pass index to experience_years factory", () => {
      faker.withExperienceYears((index) => index + 1);
      const musician = faker.build();
      expect(musician.experience_years).toBe(1);

      const fakerMany = MusicianFakeBuilder.theMusicians(2);
      fakerMany.withExperienceYears((index) => index + 1);
      const musicians = fakerMany.build();
      expect(musicians[0].experience_years).toBe(1);
      expect(musicians[1].experience_years).toBe(2);
    });

    test("invalid negative case", () => {
      const $this = faker.withExperienceYears(-1);
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_experience_years"]).toBe(-1);

      faker.withExperienceYears(-5);
      expect(faker["_experience_years"]).toBe(-5);
    });
  });

  describe("is_active prop", () => {
    const faker = MusicianFakeBuilder.aMusician();
    test("should be a function", () => {
      expect(typeof faker["_is_active"]).toBe("function");
    });

    test("activate", () => {
      const $this = faker.activate();
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_is_active"]).toBe(true);
    });

    test("deactivate", () => {
      const $this = faker.deactivate();
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_is_active"]).toBe(false);
    });

    test("should set is_active directly", () => {
      faker.activate();
      expect(faker["_is_active"]).toBe(true);

      faker.deactivate();
      expect(faker["_is_active"]).toBe(false);
    });

    test("should set is_active using activate/deactivate methods", () => {
      const faker = MusicianFakeBuilder.aMusician();
      faker.activate();
      const musician = faker.build();
      expect(musician.is_active).toBe(true);

      const faker2 = MusicianFakeBuilder.aMusician();
      faker2.deactivate();
      const musician2 = faker2.build();
      expect(musician2.is_active).toBe(false);
    });
  });

  describe("created_at prop", () => {
    const faker = MusicianFakeBuilder.aMusician();

    test("should throw error when any with methods has called", () => {
      const fakerMusician = MusicianFakeBuilder.aMusician();
      expect(() => fakerMusician.created_at).toThrowError(
        new Error("Property created_at not have a factory, use 'with' methods"),
      );
    });

    test("should be undefined", () => {
      expect(faker["_created_at"]).toBeUndefined();
    });

    test("withcreated_at", () => {
      const date = new Date();
      const $this = faker.withcreated_at(date);
      expect($this).toBeInstanceOf(MusicianFakeBuilder);
      expect(faker["_created_at"]).toBe(date);

      faker.withcreated_at(() => date);
      //@ts-expect-error _created_at is a callable
      expect(faker["_created_at"]()).toBe(date);
      expect(faker.created_at).toBe(date);
    });

    test("should pass index to created_at factory", () => {
      const date = new Date();
      faker.withcreated_at((index) => new Date(date.getTime() + index + 2));
      const musician = faker.build();
      expect(musician.created_at.getTime()).toBe(date.getTime() + 2);

      const fakerMany = MusicianFakeBuilder.theMusicians(2);
      fakerMany.withcreated_at((index) => new Date(date.getTime() + index + 2));
      const musicians = fakerMany.build();
      expect(musicians[0].created_at.getTime()).toBe(date.getTime() + 2);
      expect(musicians[1].created_at.getTime()).toBe(date.getTime() + 3);
    });
  });

  test("should create a musician", () => {
    const faker = MusicianFakeBuilder.aMusician();
    let musician = faker.build();

    expect(musician.id).toBeInstanceOf(MusicianId);
    expect(typeof musician.name === "string").toBeTruthy();
    expect(musician.email).toBeInstanceOf(Email);
    expect(musician.stage_name).toBeNull();
    expect(musician.bio).toBeNull();
    expect(musician.avatar).toBeNull();
    expect(musician.phone).toBeNull();
    expect(Array.isArray(musician.genres)).toBeTruthy();
    expect(musician.genres.length).toBeGreaterThan(0);
    expect(Array.isArray(musician.instruments)).toBeTruthy();
    expect(musician.instruments.length).toBeGreaterThan(0);
    expect(typeof musician.experience_years === "number").toBeTruthy();
    expect(musician.experience_years).toBeGreaterThanOrEqual(0);
    expect(musician.qr_code).toBeInstanceOf(QRCode);
    expect(musician.rating).toBeInstanceOf(Rating);
    expect(musician.total_ratings).toBe(0);
    expect(typeof musician.is_active === "boolean").toBeTruthy();
    expect(typeof musician.is_verified === "boolean").toBeTruthy();
    expect(musician.created_at).toBeInstanceOf(Date);

    const created_at = new Date();
    const id = new MusicianId();
    musician = faker
      .withMusicianId(id)
      .withName("test name")
      .withEmail("test@example.com")
      .withStageName("Test Stage")
      .withBio("Test bio")
      .withAvatar("https://example.com/avatar.jpg")
      .withPhone("+5511999999999")
      .withGenres(["Rock", "Pop"])
      .withInstruments(["Guitar", "Piano"])
      .withExperienceYears(5)
      .activate()
      .withcreated_at(created_at)
      .build();

    expect(musician.id.id).toBe(id.id);
    expect(musician.name).toBe("test name");
    expect(musician.email.value).toBe("test@example.com");
    expect(musician.stage_name).toBe("Test Stage");
    expect(musician.bio).toBe("Test bio");
    expect(musician.avatar).toBe("https://example.com/avatar.jpg");
    expect(musician.phone?.value).toBe("+5511999999999");
    expect(musician.genres).toEqual(["Rock", "Pop"]);
    expect(musician.instruments).toEqual(["Guitar", "Piano"]);
    expect(musician.experience_years).toBe(5);
    expect(musician.is_active).toBe(true);
    expect(musician.created_at).toBe(created_at);
  });

  test("should create many musicians", () => {
    const faker = MusicianFakeBuilder.theMusicians(2);
    let musicians = faker.build();

    musicians.forEach((musician) => {
      expect(musician.id).toBeInstanceOf(MusicianId);
      expect(typeof musician.name === "string").toBeTruthy();
      expect(musician.email).toBeInstanceOf(Email);
      expect(musician.created_at).toBeInstanceOf(Date);
    });

    musicians = faker
      .withName((index) => `test name ${index}`)
      .withEmail((index) => `test${index}@example.com`)
      .withStageName((index) => `Test Stage ${index}`)
      .withBio((index) => `Test bio ${index}`)
      .withAvatar((index) => `https://example.com/avatar${index}.jpg`)
      .withPhone((index) => `+551199999999${index}`)
      .withGenres((index) => [`Genre${index}`])
      .withInstruments((index) => [`Instrument${index}`])
      .withExperienceYears((index) => index + 1)
      .activate()
      .build();

    musicians.forEach((musician, index) => {
      expect(musician.name).toBe(`test name ${index}`);
      expect(musician.email.value).toBe(`test${index}@example.com`);
      expect(musician.stage_name).toBe(`Test Stage ${index}`);
      expect(musician.bio).toBe(`Test bio ${index}`);
      expect(musician.avatar).toBe(`https://example.com/avatar${index}.jpg`);
      expect(musician.phone?.value).toBe(`+551199999999${index}`);
      expect(musician.genres).toEqual([`Genre${index}`]);
      expect(musician.instruments).toEqual([`Instrument${index}`]);
      expect(musician.experience_years).toBe(index + 1);
      expect(musician.is_active).toBe(true);
    });
  });
});
