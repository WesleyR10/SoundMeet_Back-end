import { Chance } from "chance";

import { AudiencePoints } from "../../../shared/domain/value-objects/audience-points.vo";
import { Email } from "../../../shared/domain/value-objects/email.vo";
import { AudienceId } from "../audience.aggregate";
import { AudienceFakeBuilder } from "../audience-fake.builder";

describe("AudienceFakeBuilder Unit Tests", () => {
  describe("id prop", () => {
    const faker = AudienceFakeBuilder.aAudience();

    test("should throw error when any with methods has called", () => {
      expect(() => faker.id).toThrow(
        new Error("Property id not have a factory, use 'with' methods"),
      );
    });

    test("should be undefined", () => {
      expect(faker["_id"]).toBeUndefined();
    });

    test("withAudienceId", () => {
      const id = new AudienceId();
      const $this = faker.withId(id);
      expect($this).toBeInstanceOf(AudienceFakeBuilder);
      expect(faker["_id"]).toBe(id);

      faker.withId(() => id);
      //@ts-expect-error _id is a callable
      expect(faker["_id"]()).toBe(id);

      expect(faker.id).toBe(id);
    });

    test("should pass index to id factory", () => {
      let mockFactory = jest.fn(() => new AudienceId());
      faker.withId(mockFactory);
      faker.build();
      expect(mockFactory).toHaveBeenCalledTimes(1);

      const audienceId = new AudienceId();
      mockFactory = jest.fn(() => audienceId);
      const fakerMany = AudienceFakeBuilder.theAudiences(2);
      fakerMany.withId(mockFactory);
      fakerMany.build();

      expect(mockFactory).toHaveBeenCalledTimes(2);
      expect(mockFactory).toHaveBeenNthCalledWith(1, 0);
      expect(mockFactory).toHaveBeenNthCalledWith(2, 1);
    });
  });

  describe("name prop", () => {
    const faker = AudienceFakeBuilder.aAudience();
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
      expect($this).toBeInstanceOf(AudienceFakeBuilder);
      expect(faker["_name"]).toBe("test name");

      faker.withName(() => "test name");
      //@ts-expect-error name is callable
      expect(faker["_name"]()).toBe("test name");

      expect(faker.name).toBe("test name");
    });

    test("should pass index to name factory", () => {
      faker.withName((index) => `test name ${index}`);
      const audience = faker.build();
      expect(audience.name).toBe("test name 0");

      const fakerMany = AudienceFakeBuilder.theAudiences(2);
      fakerMany.withName((index) => `test name ${index}`);
      const audiences = fakerMany.build();

      expect(audiences[0].name).toBe("test name 0");
      expect(audiences[1].name).toBe("test name 1");
    });

    test("invalid too long case", () => {
      const $this = faker.withInvalidNameTooLong();
      expect($this).toBeInstanceOf(AudienceFakeBuilder);
      expect(faker["_name"].length).toBe(256);

      const tooLong = "a".repeat(256);
      faker.withInvalidNameTooLong(tooLong);
      expect(faker["_name"]).toBe(tooLong);

      expect(faker.name).toBe(tooLong);
    });
  });

  describe("email prop", () => {
    const faker = AudienceFakeBuilder.aAudience();
    test("should be a function", () => {
      expect(typeof faker["_email"]).toBe("function");
    });

    test("withEmail", () => {
      const $this = faker.withEmail("test@example.com");
      expect($this).toBeInstanceOf(AudienceFakeBuilder);
      expect(faker["_email"]).toBe("test@example.com");

      faker.withEmail(() => "test@example.com");
      //@ts-expect-error email is callable
      expect(faker["_email"]()).toBe("test@example.com");

      expect(faker.email).toBe("test@example.com");
    });

    test("should pass index to email factory", () => {
      faker.withEmail((index) => `test${index}@example.com`);
      const audience = faker.build();
      expect(audience.email.value).toBe("test0@example.com");

      const fakerMany = AudienceFakeBuilder.theAudiences(2);
      fakerMany.withEmail((index) => `test${index}@example.com`);
      const audiences = fakerMany.build();

      expect(audiences[0].email.value).toBe("test0@example.com");
      expect(audiences[1].email.value).toBe("test1@example.com");
    });

    test("invalid email case", () => {
      const $this = faker.withInvalidEmailTooLong();
      expect($this).toBeInstanceOf(AudienceFakeBuilder);
      expect(faker["_email"].length).toBe(256);

      const invalidEmail = "a".repeat(64) + "@" + "b".repeat(188) + ".com";
      faker.withInvalidEmailTooLong(invalidEmail);
      expect(faker["_email"]).toBe(invalidEmail);

      expect(faker.email).toBe(invalidEmail);
    });
  });

  describe("nickname prop", () => {
    const faker = AudienceFakeBuilder.aAudience();
    test("should be a function", () => {
      expect(typeof faker["_nickname"]).toBe("function");
    });

    test("withNickname", () => {
      const $this = faker.withNickname("test_nickname");
      expect($this).toBeInstanceOf(AudienceFakeBuilder);
      expect(faker["_nickname"]).toBe("test_nickname");

      faker.withNickname(() => "test_nickname");
      //@ts-expect-error nickname is callable
      expect(faker["_nickname"]()).toBe("test_nickname");

      expect(faker.nickname).toBe("test_nickname");
    });

    test("should pass index to nickname factory", () => {
      faker.withNickname((index) => `test_nickname_${index}`);
      const audience = faker.build();
      expect(audience.nickname).toBe("test_nickname_0");

      const fakerMany = AudienceFakeBuilder.theAudiences(2);
      fakerMany.withNickname((index) => `test_nickname_${index}`);
      const audiences = fakerMany.build();

      expect(audiences[0].nickname).toBe("test_nickname_0");
      expect(audiences[1].nickname).toBe("test_nickname_1");
    });
  });

  describe("avatar prop", () => {
    const faker = AudienceFakeBuilder.aAudience();
    test("should be a function", () => {
      expect(typeof faker["_avatar"]).toBe("function");
    });

    test("withAvatar", () => {
      const $this = faker.withAvatar("avatar.jpg");
      expect($this).toBeInstanceOf(AudienceFakeBuilder);
      expect(faker["_avatar"]).toBe("avatar.jpg");

      faker.withAvatar(() => "avatar.jpg");
      //@ts-expect-error avatar is callable
      expect(faker["_avatar"]()).toBe("avatar.jpg");

      expect(faker.avatar).toBe("avatar.jpg");
    });

    test("should pass index to avatar factory", () => {
      faker.withAvatar((index) => `avatar_${index}.jpg`);
      const audience = faker.build();
      expect(audience.avatar).toBe("avatar_0.jpg");

      const fakerMany = AudienceFakeBuilder.theAudiences(2);
      fakerMany.withAvatar((index) => `avatar_${index}.jpg`);
      const audiences = fakerMany.build();

      expect(audiences[0].avatar).toBe("avatar_0.jpg");
      expect(audiences[1].avatar).toBe("avatar_1.jpg");
    });
  });

  describe("phone prop", () => {
    const faker = AudienceFakeBuilder.aAudience();
    test("should be a function", () => {
      expect(typeof faker["_phone"]).toBe("function");
    });

    test("withPhone", () => {
      const $this = faker.withPhone("+5511999999999");
      expect($this).toBeInstanceOf(AudienceFakeBuilder);
      expect(faker["_phone"]).toBe("+5511999999999");

      faker.withPhone(() => "+5511999999999");
      //@ts-expect-error phone is callable
      expect(faker["_phone"]()).toBe("+5511999999999");

      expect(faker.phone).toBe("+5511999999999");
    });

    test("should pass index to phone factory", () => {
      faker.withPhone((index) => `+551199999999${index}`);
      const audience = faker.build();
      expect(audience.phone?.value).toBe("+5511999999990");

      const fakerMany = AudienceFakeBuilder.theAudiences(2);
      fakerMany.withPhone((index) => `+551199999999${index}`);
      const audiences = fakerMany.build();

      expect(audiences[0].phone?.value).toBe("+5511999999990");
      expect(audiences[1].phone?.value).toBe("+5511999999991");
    });
  });

  describe("favorite_genres prop", () => {
    const faker = AudienceFakeBuilder.aAudience();
    test("should be a function", () => {
      expect(typeof faker["_favorite_genres"]).toBe("function");
    });

    test("withFavoriteGenres", () => {
      const genres = ["Rock", "Jazz"];
      const $this = faker.withFavoriteGenres(genres);
      expect($this).toBeInstanceOf(AudienceFakeBuilder);
      expect(faker["_favorite_genres"]).toBe(genres);

      faker.withFavoriteGenres(() => genres);
      //@ts-expect-error favorite_genres is callable
      expect(faker["_favorite_genres"]()).toBe(genres);

      expect(faker.favorite_genres).toBe(genres);
    });

    test("should pass index to favorite_genres factory", () => {
      faker.withFavoriteGenres((index) => [`Rock`]); // Using valid genre
      const audience = faker.build();
      expect(audience.favorite_genres).toEqual(["Rock"]);

      const fakerMany = AudienceFakeBuilder.theAudiences(2);
      fakerMany.withFavoriteGenres((index) => [`Jazz`]); // Using valid genre
      const audiences = fakerMany.build();

      expect(audiences[0].favorite_genres).toEqual(["Jazz"]);
      expect(audiences[1].favorite_genres).toEqual(["Jazz"]);
    });
  });

  describe("is_active prop", () => {
    const faker = AudienceFakeBuilder.aAudience();
    test("should be a function", () => {
      expect(typeof faker["_is_active"]).toBe("function");
    });

    test("activate", () => {
      const $this = faker.activate();
      expect($this).toBeInstanceOf(AudienceFakeBuilder);
      expect(faker["_is_active"]).toBe(true);
      expect(faker.is_active).toBe(true);
    });

    test("deactivate", () => {
      const $this = faker.deactivate();
      expect($this).toBeInstanceOf(AudienceFakeBuilder);
      expect(faker["_is_active"]).toBe(false);
      expect(faker.is_active).toBe(false);
    });

    test("withIsActive", () => {
      const $this = faker.withIsActive(false);
      expect($this).toBeInstanceOf(AudienceFakeBuilder);
      expect(faker["_is_active"]).toBe(false);

      faker.withIsActive(() => false);
      //@ts-expect-error is_active is callable
      expect(faker["_is_active"]()).toBe(false);

      expect(faker.is_active).toBe(false);
    });

    test("should pass index to is_active factory", () => {
      faker.withIsActive((index) => index % 2 === 0);
      const audience = faker.build();
      expect(audience.is_active).toBe(true);

      const fakerMany = AudienceFakeBuilder.theAudiences(2);
      fakerMany.withIsActive((index) => index % 2 === 0);
      const audiences = fakerMany.build();

      expect(audiences[0].is_active).toBe(true);
      expect(audiences[1].is_active).toBe(false);
    });
  });

  describe("created_at prop", () => {
    const faker = AudienceFakeBuilder.aAudience();

    test("should throw error when any with methods has called", () => {
      const fakerAudience = AudienceFakeBuilder.aAudience();
      expect(() => fakerAudience.created_at).toThrow(
        new Error("Property created_at not have a factory, use 'with' methods"),
      );
    });

    test("should be undefined", () => {
      expect(faker["_created_at"]).toBeUndefined();
    });

    test("withCreatedAt", () => {
      const date = new Date();
      const $this = faker.withCreatedAt(date);
      expect($this).toBeInstanceOf(AudienceFakeBuilder);
      expect(faker["_created_at"]).toBe(date);

      faker.withCreatedAt(() => date);
      //@ts-expect-error _created_at is a callable
      expect(faker["_created_at"]()).toBe(date);
      expect(faker.created_at).toBe(date);
    });

    test("should pass index to created_at factory", () => {
      const date = new Date();
      faker.withCreatedAt((index) => new Date(date.getTime() + index));
      const audience = faker.build();
      expect(audience.created_at.getTime()).toBe(date.getTime() + 0);

      const fakerMany = AudienceFakeBuilder.theAudiences(2);
      fakerMany.withCreatedAt((index) => new Date(date.getTime() + index));
      const audiences = fakerMany.build();

      expect(audiences[0].created_at.getTime()).toBe(date.getTime() + 0);
      expect(audiences[1].created_at.getTime()).toBe(date.getTime() + 1);
    });
  });

  test("should create an audience", () => {
    const faker = AudienceFakeBuilder.aAudience();
    let audience = faker.build();

    expect(audience.audience_id).toBeInstanceOf(AudienceId);
    expect(typeof audience.name === "string").toBeTruthy();
    expect(audience.email).toBeInstanceOf(Email);
    expect(audience.nickname).toBeNull();
    expect(audience.avatar).toBeNull();
    expect(audience.phone).toBeNull();
    expect(Array.isArray(audience.preferences.favoriteGenres)).toBeTruthy();
    expect(audience.points).toBeInstanceOf(AudiencePoints);
    expect(audience.is_active).toBe(true);
    expect(audience.created_at).toBeInstanceOf(Date);

    const created_at = new Date();
    const id = new AudienceId();
    audience = faker
      .withId(id)
      .withName("name test")
      .withEmail("test@example.com")
      .withNickname("test_nickname")
      .withAvatar("avatar.jpg")
      .withPhone("+5511999999999")
      .withFavoriteGenres(["Rock", "Jazz"])
      .deactivate()
      .withCreatedAt(created_at)
      .build();

    expect(audience.audience_id.id).toBe(id.id);
    expect(audience.name).toBe("name test");
    expect(audience.email.value).toBe("test@example.com");
    expect(audience.nickname).toBe("test_nickname");
    expect(audience.avatar).toBe("avatar.jpg");
    expect(audience.phone?.value).toBe("+5511999999999");
    expect(audience.favorite_genres).toEqual(["Rock", "Jazz"]);
    expect(audience.is_active).toBe(false);
    expect(audience.created_at).toBe(created_at);
  });

  test("should create many audiences", () => {
    const faker = AudienceFakeBuilder.theAudiences(2);
    let audiences = faker.build();

    audiences.forEach((audience) => {
      expect(audience.audience_id).toBeInstanceOf(AudienceId);
      expect(typeof audience.name === "string").toBeTruthy();
      expect(audience.email).toBeInstanceOf(Email);
      expect(audience.nickname).toBeNull();
      expect(audience.avatar).toBeNull();
      expect(audience.phone).toBeNull();
      expect(Array.isArray(audience.preferences.favoriteGenres)).toBeTruthy();
      expect(audience.points).toBeInstanceOf(AudiencePoints);
      expect(audience.is_active).toBe(true);
      expect(audience.created_at).toBeInstanceOf(Date);
    });

    const created_at = new Date();
    const id = new AudienceId();
    audiences = faker
      .withId(id)
      .withName("name test")
      .withEmail("test@example.com")
      .withNickname("test_nickname")
      .withAvatar("avatar.jpg")
      .withPhone("+5511999999999")
      .withFavoriteGenres(["Rock", "Jazz"])
      .deactivate()
      .withCreatedAt(created_at)
      .build();

    audiences.forEach((audience) => {
      expect(audience.audience_id.id).toBe(id.id);
      expect(audience.name).toBe("name test");
      expect(audience.email.value).toBe("test@example.com");
      expect(audience.nickname).toBe("test_nickname");
      expect(audience.avatar).toBe("avatar.jpg");
      expect(audience.phone?.value).toBe("+5511999999999");
      expect(audience.favorite_genres).toEqual(["Rock", "Jazz"]);
      expect(audience.preferences.favoriteGenres).toEqual(["Rock", "Jazz"]);
      expect(audience.is_active).toBe(false);
      expect(audience.created_at).toBe(created_at);
    });
  });
});
