import {
  MusicianRules,
  MusicianValidator,
  MusicianValidatorFactory,
} from "../musician.validator";
import { Musician } from "../musician.aggregate";
import { Notification } from "../../../shared/domain/validators/notification";

describe("MusicianValidator Tests", () => {
  let validator: MusicianValidator;
  let notification: Notification;

  beforeEach(() => {
    validator = MusicianValidatorFactory.create();
    notification = new Notification();
  });

  test("invalidation cases for name field", () => {
    let isValid = validator.validate(notification, null as any);
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, { name: null });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, { name: "" });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, { name: 5 as any });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, { name: "t".repeat(256) });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();
  });

  test("invalidation cases for email field", () => {
    notification = new Notification();
    let isValid = validator.validate(notification, { name: "John Doe" });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, {
      name: "John Doe",
      email: null,
    });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, { name: "John Doe", email: "" });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, {
      name: "John Doe",
      email: 5 as any,
    });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, {
      name: "John Doe",
      email: "invalid-email",
    });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();
  });

  test("valid cases", () => {
    notification = new Notification();
    const isValid = validator.validate(notification, {
      name: "John Doe",
      email: "john@example.com",
    });
    expect(isValid).toBeTruthy();
    expect(notification.hasErrors()).toBeFalsy();
  });
});

describe("MusicianRules Unit Tests", () => {
  test("should create rules", () => {
    const musician = Musician.fake().aMusician().build();
    const rules = new MusicianRules(musician);
    expect(rules).toBeDefined();
    expect(rules.name).toBe(musician.name);
    expect(rules.email).toBe(musician.email.value);
    expect(rules.stage_name).toBe(musician.stage_name);
    expect(rules.bio).toBe(musician.bio);
    expect(rules.avatar).toBe(musician.avatar);
    expect(rules.phone).toBe(musician.phone?.value || null);
    expect(rules.genres).toEqual(musician.genres);
    expect(rules.instruments).toEqual(musician.instruments);
    expect(rules.experience_years).toBe(musician.experience_years);
    expect(rules.is_active).toBe(musician.is_active);
    expect(rules.is_verified).toBe(musician.is_verified);
  });
});

describe("MusicianValidatorFactory Unit Tests", () => {
  test("should create a validator", () => {
    const validator = MusicianValidatorFactory.create();
    expect(validator).toBeInstanceOf(MusicianValidator);
  });
});
