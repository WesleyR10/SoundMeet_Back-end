import { Uuid } from "../../../shared/domain";
import { Notification } from "../../../shared/domain/validators/notification";
import { MusicianProfile } from "../musician-profile.aggregate";
import {
  MusicianProfileRules,
  MusicianProfileValidator,
  MusicianProfileValidatorFactory,
} from "../musician-profile.validator";

describe("MusicianProfileValidator Tests", () => {
  let validator: MusicianProfileValidator;
  let notification: Notification;

  beforeEach(() => {
    validator = MusicianProfileValidatorFactory.create();
    notification = new Notification();
  });

  test("invalidation cases for musician_id field", () => {
    let isValid = validator.validate(notification, null as any);
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, { musician_id: null });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, { musician_id: "not-a-uuid" });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();
  });

  test("invalidation cases for experience field", () => {
    notification = new Notification();
    const isValid = validator.validate(notification, {
      musician_id: new Uuid().id,
      experience: -1,
      instruments: ["Guitar"],
      genres: ["Rock"],
      location: {},
      socialLinks: null,
      rating: 0,
      total_ratings: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();
  });

  test("valid cases", () => {
    notification = new Notification();
    const isValid = validator.validate(notification, {
      musician_id: new Uuid().id,
      experience: 0,
      instruments: [],
      genres: [],
      location: {},
      socialLinks: null,
      rating: 0,
      total_ratings: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    expect(isValid).toBeTruthy();
    expect(notification.hasErrors()).toBeFalsy();
  });
});

describe("MusicianProfileRules Unit Tests", () => {
  test("should create rules", () => {
    const profile = MusicianProfile.fake().aProfile().build();
    const rules = new MusicianProfileRules(profile);
    expect(rules).toBeDefined();
    expect(rules.musician_id).toBe(profile.musician_id.id);
    expect(rules.experience).toBe(profile.experience);
    expect(rules.instruments).toEqual(profile.instruments);
    expect(rules.genres).toEqual(profile.genres);
    expect(rules.socialLinks).toBe(profile.socialLinks);
    expect(rules.rating).toBe(profile.rating.value);
    expect(rules.total_ratings).toBe(profile.total_ratings);
    expect(rules.created_at).toBe(profile.created_at);
    expect(rules.updated_at).toBe(profile.updated_at);
  });
});

describe("MusicianProfileValidatorFactory Unit Tests", () => {
  test("should create a validator", () => {
    const validator = MusicianProfileValidatorFactory.create();
    expect(validator).toBeInstanceOf(MusicianProfileValidator);
  });
});
