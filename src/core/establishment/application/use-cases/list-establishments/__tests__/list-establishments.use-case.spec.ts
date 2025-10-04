import { EstablishmentInMemoryRepository } from "../../../../infra/db/in-memory/establishment-in-memory.repository";
import { ListEstablishmentsUseCase } from "../list-establishments.use-case";
import { EstablishmentFakeBuilder } from "../../../../domain/establishment-fake.builder";
import { EstablishmentSearchResult } from "../../../../domain/establishment.repository";

describe("ListEstablishmentsUseCase Unit Tests", () => {
  let useCase: ListEstablishmentsUseCase;
  let repository: EstablishmentInMemoryRepository;

  beforeEach(() => {
    repository = new EstablishmentInMemoryRepository();
    useCase = new ListEstablishmentsUseCase(repository);
  });

  test("toOutput method", () => {
    let result = new EstablishmentSearchResult({
      items: [],
      total: 0,
      current_page: 1,
      per_page: 15,
    });
    let output = useCase["toOutput"](result);
    expect(output).toMatchObject({
      items: [],
      total: 0,
      current_page: 1,
      per_page: 15,
      last_page: 0,
    });

    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    result = new EstablishmentSearchResult({
      items: [establishment],
      total: 1,
      current_page: 1,
      per_page: 1,
    });
    output = useCase["toOutput"](result);
    expect(output).toStrictEqual({
      items: [
        {
          id: establishment.id.id,
          name: establishment.name,
          email: establishment.email.value,
          cnpj: establishment.cnpj
            ? {
                formatted: establishment.cnpj.formatted,
                value: establishment.cnpj.value,
              }
            : null,
          description: establishment.description,
          avatar: establishment.avatar,
          phone: establishment.phone?.value || null,
          address_street: establishment.address?.street || null,
          address_number: establishment.address?.number || null,
          address_neighborhood: establishment.address?.neighborhood || null,
          address_city: establishment.address?.city || null,
          address_state: establishment.address?.state || null,
          address_zipcode: establishment.address?.zipCode || null,
          website: establishment.website,
          establishment_type: establishment.establishment_type,
          qr_code: expect.any(String),
          rating: establishment.rating.value,
          total_ratings: establishment.total_ratings,
          is_active: establishment.is_active,
          is_verified: establishment.is_verified,
          created_at: establishment.created_at,
          is_highly_rated: establishment.isHighlyRated,
          is_popular: establishment.isPopular,
          is_bar: establishment.isBar,
          is_restaurant: establishment.isRestaurant,
          is_club: establishment.isClub,
        },
      ],
      total: 1,
      current_page: 1,
      per_page: 1,
      last_page: 1,
    });
  });

  it("should return establishments ordered by created_at when input is empty", async () => {
    const establishments = EstablishmentFakeBuilder.theEstablishments(2)
      .withName((index) => `Establishment ${index}`)
      .withcreated_at((index) => new Date(new Date().getTime() + index))
      .build();

    repository.items = establishments;

    const output = await useCase.execute({});

    expect(output).toStrictEqual({
      items: [
        {
          id: establishments[1].id.id,
          name: establishments[1].name,
          description: establishments[1].description,
          avatar: establishments[1].avatar,
          cnpj: establishments[1].cnpj
            ? {
                formatted: establishments[1].cnpj.formatted,
                value: establishments[1].cnpj.value,
              }
            : null,
          email: establishments[1].email.value,
          phone: establishments[1].phone?.value || null,
          website: establishments[1].website,
          address_street: establishments[1].address.street,
          address_number: establishments[1].address.number,
          address_neighborhood: establishments[1].address.neighborhood,
          address_city: establishments[1].address.city,
          address_state: establishments[1].address.state,
          address_zipcode: establishments[1].address.zipCode,
          qr_code: expect.any(String),
          establishment_type: establishments[1].establishment_type,
          rating: establishments[1].rating.value,
          total_ratings: establishments[1].total_ratings,
          is_active: establishments[1].is_active,
          is_verified: establishments[1].is_verified,
          created_at: establishments[1].created_at,
          is_highly_rated: establishments[1].isHighlyRated,
          is_popular: establishments[1].isPopular,
          is_bar: establishments[1].isBar,
          is_restaurant: establishments[1].isRestaurant,
          is_club: establishments[1].isClub,
        },
        {
          id: establishments[0].id.id,
          name: establishments[0].name,
          description: establishments[0].description,
          avatar: establishments[0].avatar,
          cnpj: establishments[0].cnpj
            ? {
                formatted: establishments[0].cnpj.formatted,
                value: establishments[0].cnpj.value,
              }
            : null,
          email: establishments[0].email.value,
          phone: establishments[0].phone?.value || null,
          website: establishments[0].website,
          address_street: establishments[0].address.street,
          address_number: establishments[0].address.number,
          address_neighborhood: establishments[0].address.neighborhood,
          address_city: establishments[0].address.city,
          address_state: establishments[0].address.state,
          address_zipcode: establishments[0].address.zipCode,
          qr_code: expect.any(String),
          establishment_type: establishments[0].establishment_type,
          rating: establishments[0].rating.value,
          total_ratings: establishments[0].total_ratings,
          is_active: establishments[0].is_active,
          is_verified: establishments[0].is_verified,
          created_at: establishments[0].created_at,
          is_highly_rated: establishments[0].isHighlyRated,
          is_popular: establishments[0].isPopular,
          is_bar: establishments[0].isBar,
          is_restaurant: establishments[0].isRestaurant,
          is_club: establishments[0].isClub,
        },
      ],
      total: 2,
      current_page: 1,
      per_page: 15,
      last_page: 1,
    });
  });

  it("should return establishments using pagination, filter and sort", async () => {
    const establishments = [
      EstablishmentFakeBuilder.anEstablishment()
        .withName("Rock Bar")
        .withcreated_at(new Date("2023-01-01"))
        .build(),
      EstablishmentFakeBuilder.anEstablishment()
        .withName("Jazz Club")
        .withcreated_at(new Date("2023-01-02"))
        .build(),
      EstablishmentFakeBuilder.anEstablishment()
        .withName("Blues Bar")
        .withcreated_at(new Date("2023-01-03"))
        .build(),
    ];

    repository.items = establishments;

    let output = await useCase.execute({
      page: 1,
      per_page: 2,
      sort: "name",
      sort_dir: "asc",
      filter: { name: "Bar" },
    });

    expect(output).toMatchObject({
      items: [
        {
          id: establishments[2].id.id,
          name: "Blues Bar",
          email: establishments[2].email.value,
          cnpj: {
            formatted: establishments[2].cnpj?.formatted || null,
            value: establishments[2].cnpj?.value || null,
          },
          description: establishments[2].description,
          avatar: establishments[2].avatar,
          phone: establishments[2].phone?.value || null,
          website: establishments[2].website,
          establishment_type: establishments[2].establishment_type,
          is_active: establishments[2].is_active,
          is_verified: establishments[2].is_verified,
          created_at: establishments[2].created_at,
        },
        {
          id: establishments[0].id.id,
          name: "Rock Bar",
          email: establishments[0].email.value,
          cnpj: establishments[0].cnpj,
          description: establishments[0].description,
          avatar: establishments[0].avatar,
          phone: establishments[0].phone?.value || null,
          website: establishments[0].website,
          establishment_type: establishments[0].establishment_type,
          is_active: establishments[0].is_active,
          is_verified: establishments[0].is_verified,
          created_at: establishments[0].created_at,
        },
      ],
      total: 2,
      current_page: 1,
      per_page: 2,
      last_page: 1,
    });

    output = await useCase.execute({
      page: 1,
      per_page: 2,
      sort: "created_at",
      sort_dir: "desc",
    });

    expect(output.items).toHaveLength(2);
    expect(output.items[0].name).toBe("Blues Bar");
    expect(output.items[1].name).toBe("Jazz Club");
  });

  it("should handle empty repository", async () => {
    const output = await useCase.execute({});

    expect(output).toStrictEqual({
      items: [],
      total: 0,
      current_page: 1,
      per_page: 15,
      last_page: 0,
    });
  });

  it("should filter establishments by name", async () => {
    const establishments = [
      EstablishmentFakeBuilder.anEstablishment().withName("Rock Bar").build(),
      EstablishmentFakeBuilder.anEstablishment().withName("Jazz Club").build(),
      EstablishmentFakeBuilder.anEstablishment().withName("Rock Cafe").build(),
    ];

    repository.items = establishments;

    const output = await useCase.execute({
      filter: { name: "Rock" },
    });

    expect(output.items).toHaveLength(2);
    expect(output.items[0].name).toContain("Rock");
    expect(output.items[1].name).toContain("Rock");
    expect(output.total).toBe(2);
  });

  it("should sort establishments by different fields", async () => {
    const establishments = [
      EstablishmentFakeBuilder.anEstablishment()
        .withName("Zebra Bar")
        .withEmail("zebra@bar.com")
        .build(),
      EstablishmentFakeBuilder.anEstablishment()
        .withName("Alpha Club")
        .withEmail("alpha@club.com")
        .build(),
    ];

    repository.items = establishments;

    // Sort by name ascending
    let output = await useCase.execute({
      sort: "name",
      sort_dir: "asc",
    });

    expect(output.items[0].name).toBe("Alpha Club");
    expect(output.items[1].name).toBe("Zebra Bar");

    // Sort by name descending
    output = await useCase.execute({
      sort: "name",
      sort_dir: "desc",
    });

    expect(output.items[0].name).toBe("Zebra Bar");
    expect(output.items[1].name).toBe("Alpha Club");
  });

  it("should handle pagination correctly", async () => {
    const establishments = EstablishmentFakeBuilder.theEstablishments(5)
      .withName((index) => `Establishment ${index + 1}`)
      .build();

    repository.items = establishments;

    // First page
    let output = await useCase.execute({
      page: 1,
      per_page: 2,
    });

    expect(output.items).toHaveLength(2);
    expect(output.current_page).toBe(1);
    expect(output.per_page).toBe(2);
    expect(output.total).toBe(5);
    expect(output.last_page).toBe(3);

    // Second page
    output = await useCase.execute({
      page: 2,
      per_page: 2,
    });

    expect(output.items).toHaveLength(2);
    expect(output.current_page).toBe(2);

    // Last page
    output = await useCase.execute({
      page: 3,
      per_page: 2,
    });

    expect(output.items).toHaveLength(1);
    expect(output.current_page).toBe(3);
  });
});
