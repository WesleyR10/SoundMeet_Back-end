import { Currency } from "../../../../../shared/domain/value-objects/money.vo";
import { PriceRange } from "../../../../../shared/domain/value-objects/price-range.vo";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../musician-in-memory.repository";

describe("MusicianInMemoryRepository", () => {
  let repository: MusicianInMemoryRepository;

  beforeEach(() => (repository = new MusicianInMemoryRepository()));

  it("should no filter items when filter object is null", async () => {
    const items = [Musician.fake().aMusician().build()];
    const filterSpy = jest.spyOn(items, "filter" as any);

    const itemsFiltered = await repository["applyFilter"](items, null);
    expect(filterSpy).not.toHaveBeenCalled();
    expect(itemsFiltered).toStrictEqual(items);
  });

  it("should filter items using name parameter", async () => {
    const items = [
      Musician.fake().aMusician().withName("John Doe").build(),
      Musician.fake().aMusician().withName("jane doe").build(),
      Musician.fake().aMusician().withName("Bob Smith").build(),
    ];
    const filterSpy = jest.spyOn(items, "filter" as any);

    const itemsFiltered = await repository["applyFilter"](items, {
      name: "doe",
    });
    expect(filterSpy).toHaveBeenCalledTimes(1);
    expect(itemsFiltered).toStrictEqual([items[0], items[1]]);
  });

  it("should filter items using stage_name parameter", async () => {
    const items = [
      Musician.fake().aMusician().withStageName("Rock Star").build(),
      Musician.fake().aMusician().withStageName("Jazz Master").build(),
      Musician.fake().aMusician().withStageName("Pop Icon").build(),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      stage_name: "star",
    });
    expect(itemsFiltered).toStrictEqual([items[0]]);
  });

  it("should filter items using email parameter", async () => {
    const items = [
      Musician.fake().aMusician().withEmail("john@example.com").build(),
      Musician.fake().aMusician().withEmail("jane@test.com").build(),
      Musician.fake().aMusician().withEmail("bob@example.org").build(),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      email: "example",
    });
    expect(itemsFiltered).toStrictEqual([items[0], items[2]]);
  });

  it("should filter items using genres parameter", async () => {
    const items = [
      Musician.fake().aMusician().withGenres(["Rock", "Blues"]).build(),
      Musician.fake().aMusician().withGenres(["Jazz", "Fusion"]).build(),
      Musician.fake().aMusician().withGenres(["Pop", "Rock"]).build(),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      genres: ["Rock"],
    });
    expect(itemsFiltered).toStrictEqual([items[0], items[2]]);
  });

  it("should filter items using instruments parameter", async () => {
    const items = [
      Musician.fake().aMusician().withInstruments(["Guitar", "Piano"]).build(),
      Musician.fake().aMusician().withInstruments(["Drums", "Bass"]).build(),
      Musician.fake().aMusician().withInstruments(["Piano", "Violin"]).build(),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      instruments: ["Piano"],
    });
    expect(itemsFiltered).toStrictEqual([items[0], items[2]]);
  });

  it("should filter items using price range parameters", async () => {
    const items = [
      Musician.fake().aMusician().withName("m1").build(),
      Musician.fake().aMusician().withName("m2").build(),
      Musician.fake().aMusician().withName("m3").build(),
    ];

    items[0].updatePriceRange(
      new PriceRange({ model: "per_event", min: 100, max: 200 }),
    );
    items[1].updatePriceRange(
      new PriceRange({
        model: "per_event",
        min: 300,
        max: 400,
        currency: Currency.USD,
      }),
    );
    items[2].updatePriceRange(
      new PriceRange({ model: "per_hour", min: 50, max: 80 }),
    );

    let itemsFiltered = await repository["applyFilter"](items, {
      price_min: 150,
      price_max: 350,
      price_model: "per_event",
    });
    expect(itemsFiltered).toStrictEqual([items[0], items[1]]);

    itemsFiltered = await repository["applyFilter"](items, {
      price_currency: Currency.USD,
    });
    expect(itemsFiltered).toStrictEqual([items[1]]);
  });

  it("should filter items using is_active parameter", async () => {
    const items = [
      Musician.fake().aMusician().activate().build(),
      Musician.fake().aMusician().deactivate().build(),
      Musician.fake().aMusician().activate().build(),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      is_active: true,
    });
    expect(itemsFiltered).toStrictEqual([items[0], items[2]]);
  });

  it("should filter items using is_verified parameter", async () => {
    const items = [
      Musician.fake().aMusician().build(),
      Musician.fake().aMusician().build(),
      Musician.fake().aMusician().build(),
    ];

    // Manually set verification status
    items[0].verify();
    items[2].verify();

    const itemsFiltered = await repository["applyFilter"](items, {
      is_verified: true,
    });
    expect(itemsFiltered).toStrictEqual([items[0], items[2]]);
  });

  it("should filter items using multiple parameters", async () => {
    const items = [
      Musician.fake()
        .aMusician()
        .withName("John Doe")
        .withGenres(["Rock"])
        .activate()
        .build(),
      Musician.fake()
        .aMusician()
        .withName("Jane Smith")
        .withGenres(["Jazz"])
        .activate()
        .build(),
      Musician.fake()
        .aMusician()
        .withName("Bob Johnson")
        .withGenres(["Rock"])
        .deactivate()
        .build(),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      genres: ["Rock"],
      is_active: true,
    });
    expect(itemsFiltered).toStrictEqual([items[0]]);
  });

  it("should sort by created_at when sort param is null", async () => {
    const created_at = new Date();

    const items = [
      Musician.fake()
        .aMusician()
        .withName("test")
        .withCreatedAt(created_at)
        .build(),
      Musician.fake()
        .aMusician()
        .withName("TEST")
        .withCreatedAt(new Date(created_at.getTime() + 100))
        .build(),
      Musician.fake()
        .aMusician()
        .withName("fake")
        .withCreatedAt(new Date(created_at.getTime() + 200))
        .build(),
    ];

    const itemsSorted = repository["applySort"](items, null, null);
    expect(itemsSorted).toStrictEqual([items[2], items[1], items[0]]);
  });

  it("should sort by name", async () => {
    const items = [
      Musician.fake().aMusician().withName("c").build(),
      Musician.fake().aMusician().withName("b").build(),
      Musician.fake().aMusician().withName("a").build(),
    ];

    let itemsSorted = repository["applySort"](items, "name", "asc");
    expect(itemsSorted).toStrictEqual([items[2], items[1], items[0]]);

    itemsSorted = repository["applySort"](items, "name", "desc");
    expect(itemsSorted).toStrictEqual([items[0], items[1], items[2]]);
  });
});
