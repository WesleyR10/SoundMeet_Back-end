import { InvariantViolationError } from "../../../shared/domain/errors/invariant-violation.error";
import { BandId } from "../band.aggregate";
import { BandFakeBuilder } from "../band-fake.builder";

describe("BandFakeBuilder Unit Tests", () => {
  describe("band_id prop", () => {
    const faker = BandFakeBuilder.aBand();

    test("should throw error when any with methods has called", () => {
      expect(() => faker.band_id).toThrowError(
        new InvariantViolationError(
          "Property band_id not have a factory, use 'with' methods",
        ),
      );
    });

    test("should be undefined", () => {
      expect(faker["_band_id"]).toBeUndefined();
    });

    test("withBandId", () => {
      const id = new BandId();
      const $this = faker.withBandId(id);
      expect($this).toBeInstanceOf(BandFakeBuilder);
      expect(faker["_band_id"]).toBe(id);

      faker.withBandId(() => id);
      //@ts-expect-error _band_id is callable
      expect(faker["_band_id"]()).toBe(id);
      expect(faker.band_id).toBe(id);
    });

    test("should pass index to band_id factory", () => {
      const ids = [new BandId(), new BandId()];
      const fakerMany = BandFakeBuilder.theBands(2);
      fakerMany.withBandId((index) => ids[index]);
      const bands = fakerMany.build();
      expect(bands[0].band_id.id).toBe(ids[0].id);
      expect(bands[1].band_id.id).toBe(ids[1].id);
    });
  });

  describe("name prop", () => {
    const faker = BandFakeBuilder.aBand();

    test("withName", () => {
      const $this = faker.withName("Band Name");
      expect($this).toBeInstanceOf(BandFakeBuilder);
      expect(faker.name).toBe("Band Name");
    });

    test("should pass index to name factory", () => {
      const fakerMany = BandFakeBuilder.theBands(2);
      fakerMany.withName((index) => `Band ${index}`);
      const bands = fakerMany.build();
      expect(bands[0].name).toBe("Band 0");
      expect(bands[1].name).toBe("Band 1");
    });
  });

  describe("created_at prop", () => {
    const faker = BandFakeBuilder.aBand();

    test("should throw error when any with methods has called", () => {
      expect(() => faker.created_at).toThrowError(
        new InvariantViolationError(
          "Property created_at not have a factory, use 'with' methods",
        ),
      );
    });

    test("withCreatedAt", () => {
      const date = new Date();
      const $this = faker.withCreatedAt(date);
      expect($this).toBeInstanceOf(BandFakeBuilder);
      expect(faker.created_at).toBe(date);
    });
  });

  test("should create a band", () => {
    const band = BandFakeBuilder.aBand().build();
    expect(typeof band.name).toBe("string");
    expect(Array.isArray(band.genres)).toBe(true);
  });

  test("should create many bands", () => {
    const bands = BandFakeBuilder.theBands(2).build();
    expect(bands).toHaveLength(2);
  });
});
