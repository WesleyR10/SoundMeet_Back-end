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

  it("should filter output by musician_id (minhas bandas), bypassing the open_to_gigs gate", async () => {
    const targetMusicianId = new Uuid().id;

    // open_to_gigs nunca setado (null) — a banda ainda não optou por
    // aparecer para estabelecimentos, mas o próprio membro precisa
    // continuar vendo a própria banda.
    const bandWithTarget = Band.fake()
      .aBand()
      .withName("Band With Target")
      .build();
    bandWithTarget.addMember(new Uuid(targetMusicianId), "Vocal", "Voz");

    const otherBand = Band.fake()
      .aBand()
      .withName("Other Band")
      .withOpenToGigs(true)
      .build();

    repository.items = [bandWithTarget, otherBand];

    const output = await useCase.execute({
      filter: { musician_id: targetMusicianId },
    });

    expect(output.items).toHaveLength(1);
    expect(output.items[0].id).toBe(bandWithTarget.band_id.id);
    expect(output.items[0].open_to_gigs).toBeNull();
  });

  it("should not list a pending/declined invite as one of 'my bands'", async () => {
    const musicianId = new Uuid();

    const pendingBand = Band.fake().aBand().withName("Pending").build();
    pendingBand.inviteMember(musicianId, "member", "guitar");

    const declinedBand = Band.fake().aBand().withName("Declined").build();
    declinedBand.inviteMember(musicianId, "member", "bass");
    declinedBand.declineInvite(musicianId);

    const acceptedBand = Band.fake().aBand().withName("Accepted").build();
    acceptedBand.inviteMember(musicianId, "member", "drums");
    acceptedBand.acceptInvite(musicianId);

    repository.items = [pendingBand, declinedBand, acceptedBand];

    const output = await useCase.execute({
      filter: { musician_id: musicianId.id },
    });

    expect(output.items).toHaveLength(1);
    expect(output.items[0].id).toBe(acceptedBand.band_id.id);
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
