import { EstablishmentOutputMapper } from "../../common/establishment-output";
import { GetHiringDashboardUseCase } from "../get-hiring-dashboard.use-case";

describe("GetHiringDashboardUseCase Unit Tests", () => {
  it("should throw NotFoundError when establishment does not exist", async () => {
    const establishmentRepo = {
      findById: jest.fn().mockResolvedValue(null),
    } as any;

    const musicianRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const bandRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const eventRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const useCase = new GetHiringDashboardUseCase(
      establishmentRepo,
      musicianRepo,
      bandRepo,
      eventRepo,
    );

    await expect(
      useCase.execute({
        establishment_id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
      } as any),
    ).rejects.toThrow();
  });

  it("should use preferred_genres as default musician genres when filter is empty", async () => {
    const establishmentRepo = {
      findById: jest.fn().mockResolvedValue({} as any),
    } as any;

    const musicianRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const bandRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const eventRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const establishmentOutput = {
      id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
      profile: {
        preferred_genres: ["rock"],
      },
    } as any;

    const mapperSpy = jest
      .spyOn(EstablishmentOutputMapper, "toOutput")
      .mockReturnValueOnce(establishmentOutput);

    const useCase = new GetHiringDashboardUseCase(
      establishmentRepo,
      musicianRepo,
      bandRepo,
      eventRepo,
    );

    await useCase.execute({
      establishment_id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
      musicians_page: 1,
      musicians_per_page: 10,
    } as any);

    expect(mapperSpy).toHaveBeenCalled();

    const searchCall = (musicianRepo.search as jest.Mock).mock.calls[0][0];
    expect(searchCall.filter.genres).toEqual(["rock"]);
  });

  it("should override preferred_genres when musician_filter.genres is provided", async () => {
    const establishmentRepo = {
      findById: jest.fn().mockResolvedValue({} as any),
    } as any;

    const musicianRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const bandRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const eventRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const establishmentOutput = {
      id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
      profile: {
        preferred_genres: ["rock"],
      },
    } as any;

    jest
      .spyOn(EstablishmentOutputMapper, "toOutput")
      .mockReturnValueOnce(establishmentOutput);

    const useCase = new GetHiringDashboardUseCase(
      establishmentRepo,
      musicianRepo,
      bandRepo,
      eventRepo,
    );

    await useCase.execute({
      establishment_id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
      musicians_page: 1,
      musicians_per_page: 10,
      filters: {
        musician_filter: {
          genres: ["jazz"],
        } as any,
      } as any,
    } as any);

    const searchCall = (musicianRepo.search as jest.Mock).mock.calls[0][0];
    expect(searchCall.filter.genres).toEqual(["jazz"]);
  });

  it("should map date_range into event filter date_gte and date_lte", async () => {
    const establishmentRepo = {
      findById: jest.fn().mockResolvedValue({} as any),
    } as any;

    const musicianRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const bandRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const eventRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const establishmentOutput = {
      id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
    } as any;

    jest
      .spyOn(EstablishmentOutputMapper, "toOutput")
      .mockReturnValueOnce(establishmentOutput);

    const useCase = new GetHiringDashboardUseCase(
      establishmentRepo,
      musicianRepo,
      bandRepo,
      eventRepo,
    );

    const start_at = new Date("2024-01-01T00:00:00Z");
    const end_at = new Date("2024-01-31T23:59:59Z");

    await useCase.execute({
      establishment_id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
      events_page: 1,
      events_per_page: 10,
      filters: {
        date_range: {
          start_at,
          end_at,
        },
      } as any,
    } as any);

    const searchCall = (eventRepo.search as jest.Mock).mock.calls[0][0];
    expect(searchCall.filter.establishment_id).toBe(
      "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
    );
    expect(searchCall.filter.date_gte).toEqual(start_at);
    expect(searchCall.filter.date_lte).toEqual(end_at);
  });

  it("should return musicians and bands and build recommendations", async () => {
    const establishmentRepo = {
      findById: jest.fn().mockResolvedValue({} as any),
    } as any;

    const musicianItem = {
      musician_id: { id: "11111111-1111-1111-1111-111111111111" },
      name: "John Doe",
      email: { value: "john@example.com" },
      stage_name: "John",
      bio: "Bio",
      avatar: "avatar.png",
      phone: { value: "+5511999999999" },
      genres: ["rock"],
      instruments: ["guitar"],
      experience_years: 5,
      qr_code: { code: "qr-code" },
      rating: { value: 4.5 },
      total_ratings: 10,
      is_active: true,
      is_verified: true,
      profile: null,
      created_at: new Date(),
      updated_at: new Date(),
      displayName: "John Doe",
      isExperienced: true,
      isHighlyRated: true,
    };

    const musicianRepo = {
      search: jest.fn().mockResolvedValue({
        items: [musicianItem],
        total: 1,
        current_page: 1,
        per_page: 10,
        last_page: 1,
      }),
    } as any;

    const bandItem = {
      band_id: { id: "22222222-2222-2222-2222-222222222222" },
      name: "Rock Band",
      description: "Desc",
      avatar: "band.png",
      genres: ["rock"],
      members: [
        {
          member_id: { id: "33333333-3333-3333-3333-333333333333" },
          musician_id: { id: musicianItem.musician_id.id },
          role: "Guitarist",
          instrument: "guitar",
          joined_at: new Date(),
        },
      ],
      priceRange: {
        model: "per_event",
        min: 100,
        max: 200,
        currency: "BRL",
        notes: null,
      },
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const bandRepo = {
      search: jest.fn().mockResolvedValue({
        items: [bandItem],
        total: 1,
        current_page: 1,
        per_page: 10,
        last_page: 1,
      }),
    } as any;

    const eventRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const establishmentOutput = {
      id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
      profile: {
        preferred_genres: ["rock"],
      },
    } as any;

    jest
      .spyOn(EstablishmentOutputMapper, "toOutput")
      .mockReturnValueOnce(establishmentOutput);

    const useCase = new GetHiringDashboardUseCase(
      establishmentRepo,
      musicianRepo,
      bandRepo,
      eventRepo,
    );

    const output = await useCase.execute({
      establishment_id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
      musicians_page: 1,
      musicians_per_page: 10,
      bands_page: 1,
      bands_per_page: 10,
    } as any);

    expect(output.compatible_musicians.items).toHaveLength(1);
    expect(output.compatible_musicians.items[0].id).toBe(
      musicianItem.musician_id.id,
    );
    expect(output.compatible_bands.items).toHaveLength(1);
    expect(output.compatible_bands.items[0].id).toBe(bandItem.band_id.id);
    expect(output.recommendations.top_musicians).toHaveLength(1);
    expect(output.recommendations.top_musicians[0].id).toBe(
      musicianItem.musician_id.id,
    );
    expect(output.recommendations.top_bands).toHaveLength(1);
    expect(output.recommendations.top_bands[0].id).toBe(bandItem.band_id.id);
  });

  it("should use preferred_genres and musician_filter.instruments together", async () => {
    const establishmentRepo = {
      findById: jest.fn().mockResolvedValue({} as any),
    } as any;

    const musicianRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const bandRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const eventRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const establishmentOutput = {
      id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
      profile: {
        preferred_genres: ["rock"],
      },
    } as any;

    jest
      .spyOn(EstablishmentOutputMapper, "toOutput")
      .mockReturnValueOnce(establishmentOutput);

    const useCase = new GetHiringDashboardUseCase(
      establishmentRepo,
      musicianRepo,
      bandRepo,
      eventRepo,
    );

    await useCase.execute({
      establishment_id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
      musicians_page: 1,
      musicians_per_page: 10,
      filters: {
        musician_filter: {
          instruments: ["guitar"],
        } as any,
      } as any,
    } as any);

    const searchCall = (musicianRepo.search as jest.Mock).mock.calls[0][0];
    expect(searchCall.filter.genres).toEqual(["rock"]);
    expect(searchCall.filter.instruments).toEqual(["guitar"]);
  });

  it("should limit recommendations to 5 musicians and 5 bands", async () => {
    const establishmentRepo = {
      findById: jest.fn().mockResolvedValue({} as any),
    } as any;

    const musicianItems = Array.from({ length: 6 }).map((_, index) => ({
      musician_id: { id: `11111111-1111-1111-1111-11111111111${index}` },
      name: `Musician ${index + 1}`,
      email: { value: `m${index + 1}@example.com` },
      stage_name: null,
      bio: null,
      avatar: null,
      phone: { value: "+5511999999999" },
      genres: ["rock"],
      instruments: ["guitar"],
      experience_years: 5,
      qr_code: { code: `qr-${index + 1}` },
      rating: { value: 4.5 },
      total_ratings: 10,
      is_active: true,
      is_verified: true,
      profile: null,
      created_at: new Date(),
      updated_at: new Date(),
      displayName: `Musician ${index + 1}`,
      isExperienced: true,
      isHighlyRated: true,
    }));

    const musicianRepo = {
      search: jest.fn().mockResolvedValue({
        items: musicianItems,
        total: 6,
        current_page: 1,
        per_page: 10,
        last_page: 1,
      }),
    } as any;

    const bandItems = Array.from({ length: 6 }).map((_, index) => ({
      band_id: { id: `22222222-2222-2222-2222-22222222222${index}` },
      name: `Band ${index + 1}`,
      description: null,
      avatar: null,
      genres: ["rock"],
      members: [
        {
          member_id: { id: `33333333-3333-3333-3333-33333333333${index}` },
          musician_id: { id: musicianItems[0].musician_id.id },
          role: "Guitarist",
          instrument: "guitar",
          joined_at: new Date(),
        },
      ],
      priceRange: {
        model: "per_event",
        min: 100,
        max: 200,
        currency: "BRL",
        notes: null,
      },
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    const bandRepo = {
      search: jest.fn().mockResolvedValue({
        items: bandItems,
        total: 6,
        current_page: 1,
        per_page: 10,
        last_page: 1,
      }),
    } as any;

    const eventRepo = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 10,
        last_page: 0,
      }),
    } as any;

    const establishmentOutput = {
      id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
    } as any;

    jest
      .spyOn(EstablishmentOutputMapper, "toOutput")
      .mockReturnValueOnce(establishmentOutput);

    const useCase = new GetHiringDashboardUseCase(
      establishmentRepo,
      musicianRepo,
      bandRepo,
      eventRepo,
    );

    const output = await useCase.execute({
      establishment_id: "3b5e3b9e-4b7f-4e74-9f5c-4a8d4e3a1111",
      musicians_page: 1,
      musicians_per_page: 10,
      bands_page: 1,
      bands_per_page: 10,
    } as any);

    expect(output.compatible_musicians.items).toHaveLength(6);
    expect(output.compatible_bands.items).toHaveLength(6);
    expect(output.recommendations.top_musicians).toHaveLength(5);
    expect(output.recommendations.top_bands).toHaveLength(5);
  });
});
