import { EstablishmentInMemoryRepository } from "../establishment-in-memory.repository";
import { Establishment } from "../../../../domain/establishment.aggregate";
import { Email } from "../../../../../shared/domain/value-objects/email.vo";
import { Address } from "../../../../../shared/domain/value-objects/address.vo";
import { Rating } from "../../../../../shared/domain/value-objects/rating.vo";

describe("EstablishmentInMemoryRepository", () => {
  let repository: EstablishmentInMemoryRepository;
  beforeEach(() => (repository = new EstablishmentInMemoryRepository()));

  it("should no filter items when filter object is null", async () => {
    const baseAddress = new Address({
      street: "Test Street",
      number: "123",
      neighborhood: "Test Neighborhood",
      city: "Test City",
      state: "TS",
      zipCode: "12345-678",
    });

    const items = [
      new Establishment({
        name: "Test",
        email: new Email("test@test.com"),
        cnpj: "84.244.955/0001-84",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
    ];
    const filterSpy = jest.spyOn(items, "filter" as any);

    const itemsFiltered = await repository["applyFilter"](items, null);
    expect(filterSpy).not.toHaveBeenCalled();
    expect(itemsFiltered).toStrictEqual(items);
  });

  it("should filter items using name parameter", async () => {
    const baseAddress = new Address({
      street: "Test Street",
      number: "123",
      neighborhood: "Test Neighborhood",
      city: "Test City",
      state: "TS",
      zipCode: "12345-678",
    });

    const items = [
      new Establishment({
        name: "Rock Bar",
        email: new Email("test1@test.com"),
        cnpj: "84.244.955/0001-84",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "jazz club",
        email: new Email("test2@test.com"),
        cnpj: "90.441.272/0001-10",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "Blues Cafe",
        email: new Email("test3@test.com"),
        cnpj: "88.226.299/0001-48",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
    ];
    const filterSpy = jest.spyOn(items, "filter" as any);

    const itemsFiltered = await repository["applyFilter"](items, {
      name: "bar",
    });
    expect(filterSpy).toHaveBeenCalledTimes(1);
    expect(itemsFiltered).toStrictEqual([items[0]]);
  });

  it("should filter items using email parameter", async () => {
    const baseAddress = new Address({
      street: "Test Street",
      number: "123",
      neighborhood: "Test Neighborhood",
      city: "Test City",
      state: "TS",
      zipCode: "12345-678",
    });

    const items = [
      new Establishment({
        name: "Test 1",
        email: new Email("contact@rockbar.com"),
        cnpj: "84.244.955/0001-84",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "Test 2",
        email: new Email("info@jazzclub.com"),
        cnpj: "90.441.272/0001-10",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "Test 3",
        email: new Email("hello@rockbar.net"),
        cnpj: "88.226.299/0001-48",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      email: "rockbar",
    });
    expect(itemsFiltered).toStrictEqual([items[0], items[2]]);
  });

  it("should filter items using cnpj parameter", async () => {
    const baseAddress = new Address({
      street: "Test Street",
      number: "123",
      neighborhood: "Test Neighborhood",
      city: "Test City",
      state: "TS",
      zipCode: "12345-678",
    });

    const items = [
      new Establishment({
        name: "Test 1",
        email: new Email("test1@test.com"),
        cnpj: "84.244.955/0001-84",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "Test 2",
        email: new Email("test2@test.com"),
        cnpj: "90.441.272/0001-10",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "Test 3",
        email: new Email("test3@test.com"),
        cnpj: "88.226.299/0001-48",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      cnpj: "84",
    });
    expect(itemsFiltered).toStrictEqual([items[0]]);
  });

  it("should filter items using multiple parameters", async () => {
    const baseAddress = new Address({
      street: "Test Street",
      number: "123",
      neighborhood: "Test Neighborhood",
      city: "Test City",
      state: "TS",
      zipCode: "12345-678",
    });

    const items = [
      new Establishment({
        name: "Rock Bar",
        email: new Email("contact@rockbar.com"),
        cnpj: "84.244.955/0001-84",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "Jazz Club",
        email: new Email("info@jazzclub.com"),
        cnpj: "90.441.272/0001-10",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "Rock Cafe",
        email: new Email("hello@rockcafe.com"),
        cnpj: "88.226.299/0001-48",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
    ];

    const itemsFiltered = await repository["applyFilter"](items, {
      name: "rock",
      email: "rockbar",
    });
    expect(itemsFiltered).toStrictEqual([items[0]]);
  });

  it("should sort by created_at when sort param is null", async () => {
    const created_at = new Date();
    const baseAddress = new Address({
      street: "Test Street",
      number: "123",
      neighborhood: "Test Neighborhood",
      city: "Test City",
      state: "TS",
      zipCode: "12345-678",
    });

    const items = [
      new Establishment({
        name: "c",
        email: new Email("test1@test.com"),
        cnpj: "84.244.955/0001-84",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
        created_at: new Date(created_at.getTime() + 300),
      }),
      new Establishment({
        name: "b",
        email: new Email("test2@test.com"),
        cnpj: "90.441.272/0001-10",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
        created_at: new Date(created_at.getTime() + 200),
      }),
      new Establishment({
        name: "a",
        email: new Email("test3@test.com"),
        cnpj: "88.226.299/0001-48",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
        created_at: new Date(created_at.getTime() + 100),
      }),
    ];

    const itemsSorted = await repository["applySort"](items, null, null);
    expect(itemsSorted).toStrictEqual([items[0], items[1], items[2]]);
  });

  it("should sort by name", async () => {
    const baseAddress = new Address({
      street: "Test Street",
      number: "123",
      neighborhood: "Test Neighborhood",
      city: "Test City",
      state: "TS",
      zipCode: "12345-678",
    });

    const items = [
      new Establishment({
        name: "c",
        email: new Email("test1@test.com"),
        cnpj: "84.244.955/0001-84",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "b",
        email: new Email("test2@test.com"),
        cnpj: "90.441.272/0001-10",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "a",
        email: new Email("test3@test.com"),
        cnpj: "88.226.299/0001-48",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
    ];

    let itemsSorted = await repository["applySort"](items, "name", "asc");
    expect(itemsSorted).toStrictEqual([items[2], items[1], items[0]]);

    itemsSorted = await repository["applySort"](items, "name", "desc");
    expect(itemsSorted).toStrictEqual([items[0], items[1], items[2]]);
  });

  it("should sort by email", async () => {
    const baseAddress = new Address({
      street: "Rua Exemplo",
      number: "123",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      zipCode: "01000-000",
    });

    const items = [
      new Establishment({
        name: "Test Establishment C",
        email: new Email("c@test.com"),
        cnpj: "84.244.955/0001-84",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "Test Establishment B",
        email: new Email("b@test.com"),
        cnpj: "90.441.272/0001-10",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "Test Establishment A",
        email: new Email("a@test.com"),
        cnpj: "88.226.299/0001-48",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
    ];

    let itemsSorted = await repository["applySort"](items, "email", "asc");
    expect(itemsSorted).toStrictEqual([items[2], items[1], items[0]]);

    itemsSorted = await repository["applySort"](items, "email", "desc");
    expect(itemsSorted).toStrictEqual([items[0], items[1], items[2]]);
  });

  it("should sort by created_at", async () => {
    const created_at = new Date();
    const baseAddress = new Address({
      street: "Test Street",
      number: "123",
      neighborhood: "Test Neighborhood",
      city: "Test City",
      state: "TS",
      zipCode: "12345-678",
    });

    const items = [
      new Establishment({
        name: "Test 1",
        email: new Email("test1@test.com"),
        cnpj: "84.244.955/0001-84",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
        created_at: new Date(created_at.getTime() + 300),
      }),
      new Establishment({
        name: "Test 2",
        email: new Email("test2@test.com"),
        cnpj: "90.441.272/0001-10",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
        created_at: new Date(created_at.getTime() + 200),
      }),
      new Establishment({
        name: "Test 3",
        email: new Email("test3@test.com"),
        cnpj: "88.226.299/0001-48",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
        created_at: new Date(created_at.getTime() + 100),
      }),
    ];

    let itemsSorted = await repository["applySort"](items, "created_at", "asc");
    expect(itemsSorted).toStrictEqual([items[2], items[1], items[0]]);

    itemsSorted = await repository["applySort"](items, "created_at", "desc");
    expect(itemsSorted).toStrictEqual([items[0], items[1], items[2]]);
  });

  it("should sort by rating", async () => {
    const baseAddress = new Address({
      street: "Test Street",
      number: "123",
      neighborhood: "Test Neighborhood",
      city: "Test City",
      state: "TS",
      zipCode: "12345-678",
    });

    const items = [
      new Establishment({
        name: "Test 1",
        email: new Email("test1@test.com"),
        cnpj: "84.244.955/0001-84",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
        rating: new Rating(3.5),
      }),
      new Establishment({
        name: "Test 2",
        email: new Email("test2@test.com"),
        cnpj: "90.441.272/0001-10",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
        rating: new Rating(4.8),
      }),
      new Establishment({
        name: "Test 3",
        email: new Email("test3@test.com"),
        cnpj: "88.226.299/0001-48",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
        rating: new Rating(2.1),
      }),
    ];

    let itemsSorted = await repository["applySort"](items, "rating", "asc");
    expect(itemsSorted.map((item) => item.rating.value)).toEqual([
      2.1, 3.5, 4.8,
    ]);

    itemsSorted = await repository["applySort"](items, "rating", "desc");
    expect(itemsSorted.map((item) => item.rating.value)).toEqual([
      4.8, 3.5, 2.1,
    ]);
  });

  it("should apply pagination", async () => {
    const baseAddress = new Address({
      street: "Test Street",
      number: "123",
      neighborhood: "Test Neighborhood",
      city: "Test City",
      state: "TS",
      zipCode: "12345-678",
    });

    const items = [
      new Establishment({
        name: "Test 1",
        email: new Email("test1@test.com"),
        cnpj: "84.244.955/0001-84",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "Test 2",
        email: new Email("test2@test.com"),
        cnpj: "90.441.272/0001-10",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "Test 3",
        email: new Email("test3@test.com"),
        cnpj: "88.226.299/0001-48",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "Test 4",
        email: new Email("test4@test.com"),
        cnpj: "40.122.464/0001-95",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
      new Establishment({
        name: "Test 5",
        email: new Email("test5@test.com"),
        cnpj: "40.122.464/0001-95",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
      }),
    ];

    let itemsPaginated = await repository["applyPaginate"](items, 1, 2);
    expect(itemsPaginated).toStrictEqual([items[0], items[1]]);

    itemsPaginated = await repository["applyPaginate"](items, 2, 2);
    expect(itemsPaginated).toStrictEqual([items[2], items[3]]);

    itemsPaginated = await repository["applyPaginate"](items, 3, 2);
    expect(itemsPaginated).toStrictEqual([items[4]]);

    itemsPaginated = await repository["applyPaginate"](items, 4, 2);
    expect(itemsPaginated).toStrictEqual([]);
  });

  it("should search using all methods", async () => {
    const baseAddress = new Address({
      street: "Test Street",
      number: "123",
      neighborhood: "Test Neighborhood",
      city: "Test City",
      state: "TS",
      zipCode: "12345-678",
    });

    const items = [
      new Establishment({
        name: "Rock Bar",
        email: new Email("contact@rockbar.com"),
        cnpj: "84.244.955/0001-84",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
        created_at: new Date("2023-01-01"),
      }),
      new Establishment({
        name: "Jazz Club",
        email: new Email("info@jazzclub.com"),
        cnpj: "90.441.272/0001-10",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
        created_at: new Date("2023-01-02"),
      }),
      new Establishment({
        name: "Blues Bar",
        email: new Email("hello@bluesbar.com"),
        cnpj: "88.226.299/0001-48",
        address: baseAddress,
        establishment_type: "bar",
        website: "http://test.com",
        created_at: new Date("2023-01-03"),
      }),
    ];

    repository.items = items;

    const searchParams = {
      page: 1,
      per_page: 2,
      sort: "name" as const,
      sort_dir: "asc" as const,
      filter: { name: "bar" },
    };

    const result = await repository.search(searchParams);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe("Blues Bar");
    expect(result.items[1].name).toBe("Rock Bar");
    expect(result.total).toBe(2);
    expect(result.current_page).toBe(1);
    expect(result.per_page).toBe(2);
    expect(result.last_page).toBe(1);
  });
});
