import { Currency } from "../../../../../shared/domain/value-objects/money.vo";
import { PriceRange } from "../../../../../shared/domain/value-objects/price-range.vo";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
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
        .withOpenToGigs(true)
        .withCreatedAt(new Date(2023, 1, 1))
        .build(),
      Band.fake()
        .aBand()
        .withName("Band B")
        .withOpenToGigs(true)
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
        formed_in: i.formed_in,
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
        address: i.address,
        open_to_gigs: i.open_to_gigs,
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
      Band.fake().aBand().withName("a").withOpenToGigs(true).build(),
      Band.fake().aBand().withName("AAA").withOpenToGigs(true).build(),
      Band.fake().aBand().withName("AaA").withOpenToGigs(true).build(),
      Band.fake().aBand().withName("b").withOpenToGigs(true).build(),
      Band.fake().aBand().withName("c").withOpenToGigs(true).build(),
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
        formed_in: i.formed_in,
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
        address: i.address,
        open_to_gigs: i.open_to_gigs,
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
        formed_in: i.formed_in,
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
        address: i.address,
        open_to_gigs: i.open_to_gigs,
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
        .withOpenToGigs(true)
        .withCreatedAt(new Date(2023, 1, 1))
        .build(),
      Band.fake()
        .aBand()
        .withName("Band B")
        .withOpenToGigs(true)
        .withCreatedAt(new Date(2023, 1, 2))
        .build(),
      Band.fake()
        .aBand()
        .withName("Band C")
        .withOpenToGigs(true)
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
          formed_in: i.formed_in,
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
          address: i.address,
          open_to_gigs: i.open_to_gigs,
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
        formed_in: i.formed_in,
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
        address: i.address,
        open_to_gigs: i.open_to_gigs,
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

  it("🔴 `musician_id` não contorna o opt-in: banda fora do radar não aparece na busca pública", async () => {
    const targetMusicianId = new Uuid();

    // open_to_gigs nunca setado (null): o líder ainda não pôs a banda na
    // busca. Até out/2026 o filtro `musician_id` pulava o gate — passando o id
    // de um integrante, qualquer um listava as bandas dele fora do radar.
    const hidden = Band.fake().aBand().withName("Hidden").build();
    hidden.inviteMember(targetMusicianId, "member", "Voz");
    hidden.acceptInvite(targetMusicianId);

    const visible = Band.fake()
      .aBand()
      .withName("Visible")
      .withOpenToGigs(true)
      .build();
    visible.inviteMember(targetMusicianId, "member", "Voz");
    visible.acceptInvite(targetMusicianId);

    repository.items = [hidden, visible];

    const output = await useCase.execute({
      filter: { musician_id: targetMusicianId.id },
    });

    expect(output.items.map((item) => item.id)).toEqual([visible.band_id.id]);
  });

  it("banda dissolvida (arquivada) não aparece na busca pública", async () => {
    const active = Band.fake().aBand().withOpenToGigs(true).build();
    const archived = Band.fake().aBand().withOpenToGigs(true).build();
    archived.deactivate();
    repository.items = [active, archived];

    const output = await useCase.execute({});

    expect(output.items.map((item) => item.id)).toEqual([active.band_id.id]);
  });

  it("never lets the caller override the open_to_gigs consent gate", async () => {
    const optedIn = Band.fake().aBand().withOpenToGigs(true).build();
    const optedOut = Band.fake().aBand().withOpenToGigs(false).build();
    const undecided = Band.fake().aBand().withOpenToGigs(null).build();
    repository.items = [optedIn, optedOut, undecided];

    const output = await useCase.execute({
      filter: { open_to_gigs: false } as any,
    });

    expect(output.items).toHaveLength(1);
    expect(output.items[0].id).toBe(optedIn.band_id.id);
  });
});
