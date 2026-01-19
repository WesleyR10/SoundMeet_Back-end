import { Uuid } from "../../../shared/domain";
import { Notification } from "../../../shared/domain/validators/notification";
import { EstablishmentProfile } from "../establishment-profile.aggregate";
import {
  EstablishmentProfileRules,
  EstablishmentProfileValidator,
  EstablishmentProfileValidatorFactory,
} from "../establishment-profile.validator";

describe("EstablishmentProfileValidator Tests", () => {
  let validator: EstablishmentProfileValidator;
  let notification: Notification;

  beforeEach(() => {
    validator = EstablishmentProfileValidatorFactory.create();
    notification = new Notification();
  });

  test("invalidation cases for establishment_id field", () => {
    let isValid = validator.validate(notification, null as any);
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, { establishment_id: null });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();

    notification = new Notification();
    isValid = validator.validate(notification, {
      establishment_id: "not-a-uuid",
    });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();
  });

  test("invalidation cases for capacity field", () => {
    notification = new Notification();
    const isValid = validator.validate(notification, {
      establishment_id: new Uuid().id,
      capacity: -1,
      location: {},
      amenities: [],
      preferredGenres: [],
      operatingHours: null,
      priceRange: null,
      socialLinks: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    expect(isValid).toBeFalsy();
    expect(notification.hasErrors()).toBeTruthy();
  });

  test("valid cases", () => {
    notification = new Notification();
    const isValid = validator.validate(notification, {
      establishment_id: new Uuid().id,
      capacity: null,
      location: {},
      amenities: [],
      preferredGenres: [],
      operatingHours: null,
      priceRange: null,
      socialLinks: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    expect(isValid).toBeTruthy();
    expect(notification.hasErrors()).toBeFalsy();
  });
});

describe("EstablishmentProfileRules Unit Tests", () => {
  test("should create rules", () => {
    const profile = EstablishmentProfile.fake().aProfile().build();
    const rules = new EstablishmentProfileRules(profile);
    expect(rules).toBeDefined();
    expect(rules.establishment_id).toBe(profile.establishment_id.id);
    expect(rules.capacity).toBe(profile.capacity);
    expect(rules.amenities).toEqual(profile.amenities);
    expect(rules.preferredGenres).toEqual(profile.preferredGenres);
    expect(rules.operatingHours).toBe(profile.operatingHours?.toJSON() ?? null);
    expect(rules.socialLinks).toBe(profile.socialLinks);
    expect(rules.created_at).toBe(profile.created_at);
    expect(rules.updated_at).toBe(profile.updated_at);
  });
});

describe("EstablishmentProfileValidatorFactory Unit Tests", () => {
  test("should create a validator", () => {
    const validator = EstablishmentProfileValidatorFactory.create();
    expect(validator).toBeInstanceOf(EstablishmentProfileValidator);
  });
});
