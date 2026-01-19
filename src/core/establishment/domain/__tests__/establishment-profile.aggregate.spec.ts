import { Uuid } from "../../../shared/domain";
import { Address } from "../../../shared/domain/value-objects/address.vo";
import { PriceRange } from "../../../shared/domain/value-objects/price-range.vo";
import { EstablishmentProfile } from "../establishment-profile.aggregate";

describe("EstablishmentProfile Unit Tests", () => {
  test("constructor should set default values", () => {
    const profile = new EstablishmentProfile({
      establishment_id: new Uuid(),
      location: new Address({
        street: "Av Paulista",
        number: "1000",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        zipCode: "01311000",
      }),
    });

    expect(profile.profile_id).toBeDefined();
    expect(profile.establishment_id).toBeDefined();
    expect(profile.capacity).toBeNull();
    expect(profile.location).toBeInstanceOf(Address);
    expect(profile.amenities).toEqual([]);
    expect(profile.preferredGenres).toEqual([]);
    expect(profile.operatingHours).toBeNull();
    expect(profile.priceRange).toBeNull();
    expect(profile.socialLinks).toBeNull();
    expect(profile.created_at).toBeInstanceOf(Date);
    expect(profile.updated_at).toBeInstanceOf(Date);
  });

  test("create should validate", () => {
    const profile = EstablishmentProfile.create({
      establishment_id: new Uuid(),
      location: new Address({
        street: "Av Paulista",
        number: "1000",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        zipCode: "01311000",
      }),
      amenities: ["stage"],
      preferredGenres: ["Rock"],
      capacity: 100,
      priceRange: new PriceRange({ model: "per_event", min: 0, max: 1000 }),
    });

    expect(profile.notification.hasErrors()).toBeFalsy();
  });

  test("changeCapacity should add error when negative", () => {
    const profile = EstablishmentProfile.fake().aProfile().build();
    profile.changeCapacity(-1);
    expect(profile.notification.hasErrors()).toBeTruthy();
  });
});
