import { Notification } from "../../../shared/domain/validators/notification";
import { Band } from "../band.aggregate";
import {
  BandRules,
  BandValidator,
  BandValidatorFactory,
} from "../band.validator";

describe("BandValidator Tests", () => {
  let validator: BandValidator;
  let notification: Notification;

  beforeEach(() => {
    validator = BandValidatorFactory.create();
    notification = new Notification();
  });

  test("invalidation cases for name field", () => {
    const band = Band.create({
      name: "Band",
      genres: ["rock"],
    });

    notification = new Notification();
    band.changeName(null as any);
    let isValid = validator.validate(notification, band, ["name"]);
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    band.changeName("");
    isValid = validator.validate(notification, band, ["name"]);
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    band.changeName("t".repeat(256));
    isValid = validator.validate(notification, band, ["name"]);
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();
  });

  test("invalidation cases for genres field", () => {
    const band = Band.create({
      name: "Band",
      genres: ["rock"],
    });

    notification = new Notification();
    band.genres = null as any;
    let isValid = validator.validate(notification, band, ["genres"]);
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    band.genres = [1] as any;
    isValid = validator.validate(notification, band, ["genres"]);
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();
  });

  test("valid cases", () => {
    const band = Band.create({
      name: "Band",
      genres: ["rock"],
      is_active: true,
    });
    const isValid = validator.validate(notification, band);
    expect(isValid).toBeTruthy();
    expect(notification.hasErrors()).toBeFalsy();
  });
});

describe("BandRules Unit Tests", () => {
  test("should create rules", () => {
    const band = Band.fake().aBand().build();
    const rules = new BandRules(band);
    expect(rules).toBeDefined();
    expect(rules.name).toBe(band.name);
    expect(rules.genres).toEqual(band.genres);
    expect(Array.isArray(rules.members)).toBe(true);
  });
});
