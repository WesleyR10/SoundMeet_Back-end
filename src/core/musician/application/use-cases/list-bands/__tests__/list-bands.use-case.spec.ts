import { Currency } from "../../../../../shared/domain/value-objects/money.vo";
import { PriceRange } from "../../../../../shared/domain/value-objects/price-range.vo";
import { Band } from "../../../../domain/band.aggregate";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { ListBandsUseCase } from "../list-bands.use-case";

describe("ListBandsUseCase Unit Tests", () => {
  let useCase: ListBandsUseCase;
  let repository: BandInMemoryRepository;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    useCase = new ListBandsUseCase(repository);
  });

  it("should return output sorted by created_at when input is empty", async () => {
    const items = [
      Band.fake()
        .aBand()
        .withName("Band A")
        .withCreatedAt(new Date(2023, 1, 1))
        .build(),
      Band.fake()
        .aBand()
        .withName("Band B")
        .withCreatedAt(new Date(2023, 1, 2))
        .build(),
    ];
    repository.items = items;

    const output = await useCase.execute({});
    expect(output).toStrictEqual({
      items: [items[1], items[0]].map((i) => ({
        id: i.band_id.id,
        name: i.name,
        description: i.description,
        avatar: i.avatar,
        genres: i.genres,
        members: i.members.map((m) => ({
          musicianId: m.musician_id.id,
          role: m.role,
          joinedAt: m.joined_at,
        })),
        priceRange: i.priceRange
          ? {
              model: i.priceRange.model,
              min: i.priceRange.min,
              max: i.priceRange.max,
              currency: i.priceRange.currency,
              notes: i.priceRange.notes,
            }
          : null,
        is_active: i.is_active,
        created_at: i.created_at,
        updated_at: i.updated_at,
      })),
      total: 2,
      current_page: 1,
      per_page: 15,
      last_page: 1,
    });
  });

  it("should return output using filter, sort and paginate", async () => {
    const items = [
      Band.fake().aBand().withName("a").build(),
      Band.fake().aBand().withName("AAA").build(),
      Band.fake().aBand().withName("AaA").build(),
      Band.fake().aBand().withName("b").build(),
      Band.fake().aBand().withName("c").build(),
    ];
    repository.items = items;

    let output = await useCase.execute({
      page: 1,
      per_page: 2,
      sort: "name",
      filter: { name: "a" },
    });
    expect(output).toStrictEqual({
      items: [items[1], items[2]].map((i) => ({
        id: i.band_id.id,
        name: i.name,
        description: i.description,
        avatar: i.avatar,
        genres: i.genres,
        members: i.members.map((m) => ({
          musicianId: m.musician_id.id,
          role: m.role,
          joinedAt: m.joined_at,
        })),
        priceRange: i.priceRange
          ? {
              model: i.priceRange.model,
              min: i.priceRange.min,
              max: i.priceRange.max,
              currency: i.priceRange.currency,
              notes: i.priceRange.notes,
            }
          : null,
        is_active: i.is_active,
        created_at: i.created_at,
        updated_at: i.updated_at,
      })),
      total: 3,
      current_page: 1,
      per_page: 2,
      last_page: 2,
    });

    output = await useCase.execute({
      page: 2,
      per_page: 2,
      sort: "name",
      filter: { name: "a" },
    });
    expect(output).toStrictEqual({
      items: [items[0]].map((i) => ({
        id: i.band_id.id,
        name: i.name,
        description: i.description,
        avatar: i.avatar,
        genres: i.genres,
        members: i.members.map((m) => ({
          musicianId: m.musician_id.id,
          role: m.role,
          joinedAt: m.joined_at,
        })),
        priceRange: i.priceRange
          ? {
              model: i.priceRange.model,
              min: i.priceRange.min,
              max: i.priceRange.max,
              currency: i.priceRange.currency,
              notes: i.priceRange.notes,
            }
          : null,
        is_active: i.is_active,
        created_at: i.created_at,
        updated_at: i.updated_at,
      })),
      total: 3,
      current_page: 2,
      per_page: 2,
      last_page: 2,
    });
  });

  it("should filter output using price range", async () => {
    const items = [
      Band.fake()
        .aBand()
        .withName("Band A")
        .withCreatedAt(new Date(2023, 1, 1))
        .build(),
      Band.fake()
        .aBand()
        .withName("Band B")
        .withCreatedAt(new Date(2023, 1, 2))
        .build(),
      Band.fake()
        .aBand()
        .withName("Band C")
        .withCreatedAt(new Date(2023, 1, 3))
        .build(),
    ];

    items[0].changePriceRange(
      new PriceRange({ model: "per_event", min: 100, max: 200 }),
    );
    items[1].changePriceRange(
      new PriceRange({
        model: "per_event",
        min: 300,
        max: 400,
        currency: Currency.USD,
      }),
    );

    repository.items = items;

    let output = await useCase.execute({
      filter: {
        price_min: 150,
        price_max: 350,
        price_model: "per_event",
      },
    });

    expect(output).toStrictEqual({
      items: [items[2], items[1], items[0]]
        .filter((i) => i.priceRange)
        .map((i) => ({
          id: i.band_id.id,
          name: i.name,
          description: i.description,
          avatar: i.avatar,
          genres: i.genres,
          members: i.members.map((m) => ({
            musicianId: m.musician_id.id,
            role: m.role,
            joinedAt: m.joined_at,
          })),
          priceRange: i.priceRange
            ? {
                model: i.priceRange.model,
                min: i.priceRange.min,
                max: i.priceRange.max,
                currency: i.priceRange.currency,
                notes: i.priceRange.notes,
              }
            : null,
          is_active: i.is_active,
          created_at: i.created_at,
          updated_at: i.updated_at,
        })),
      total: 2,
      current_page: 1,
      per_page: 15,
      last_page: 1,
    });

    output = await useCase.execute({
      filter: {
        price_currency: Currency.USD,
      },
    });

    expect(output).toStrictEqual({
      items: [items[1]].map((i) => ({
        id: i.band_id.id,
        name: i.name,
        description: i.description,
        avatar: i.avatar,
        genres: i.genres,
        members: i.members.map((m) => ({
          musicianId: m.musician_id.id,
          role: m.role,
          joinedAt: m.joined_at,
        })),
        priceRange: i.priceRange
          ? {
              model: i.priceRange.model,
              min: i.priceRange.min,
              max: i.priceRange.max,
              currency: i.priceRange.currency,
              notes: i.priceRange.notes,
            }
          : null,
        is_active: i.is_active,
        created_at: i.created_at,
        updated_at: i.updated_at,
      })),
      total: 1,
      current_page: 1,
      per_page: 15,
      last_page: 1,
    });
  });
});
