import { PriceRange } from "../../../../../shared/domain/value-objects/price-range.vo";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianSearchResult } from "../../../../domain/musician.repository";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { MusicianOutputMapper } from "../../common/musician-profile-output";
import { ListMusiciansUseCase } from "../list-musicians.use-case";

describe("ListMusiciansUseCase Unit Tests", () => {
  let useCase: ListMusiciansUseCase;
  let repository: MusicianInMemoryRepository;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    useCase = new ListMusiciansUseCase(repository);
  });

  test("toOutput method", () => {
    let result = new MusicianSearchResult({
      items: [],
      total: 1,
      current_page: 1,
      per_page: 2,
    });
    let output = useCase["toOutput"](result);
    expect(output).toStrictEqual({
      items: [],
      total: 1,
      current_page: 1,
      per_page: 2,
      last_page: 1,
    });

    const entity = Musician.fake().aMusician().build();
    result = new MusicianSearchResult({
      items: [entity],
      total: 1,
      current_page: 1,
      per_page: 2,
    });

    output = useCase["toOutput"](result);
    expect(output).toStrictEqual({
      items: [entity].map(MusicianOutputMapper.toOutput),
      total: 1,
      current_page: 1,
      per_page: 2,
      last_page: 1,
    });
  });

  it("should return output sorted by created_at when input param is empty", async () => {
    const items = [
      Musician.fake().aMusician().withOpenToGigs(true).build(),
      Musician.fake()
        .aMusician()
        .withOpenToGigs(true)
        .withcreated_at(new Date(new Date().getTime() + 100))
        .build(),
    ];
    repository.items = items;

    const output = await useCase.execute({});
    expect(output).toStrictEqual({
      items: [...items].reverse().map(MusicianOutputMapper.toOutput),
      total: 2,
      current_page: 1,
      per_page: 15,
      last_page: 1,
    });
  });

  it("should return output using pagination, sort and filter", async () => {
    const items = [
      Musician.fake().aMusician().withName("test").withOpenToGigs(true).build(),
      Musician.fake().aMusician().withName("AAA").withOpenToGigs(true).build(),
      Musician.fake().aMusician().withName("AaA").withOpenToGigs(true).build(),
      Musician.fake().aMusician().withName("bob").withOpenToGigs(true).build(),
      Musician.fake().aMusician().withName("charlie").withOpenToGigs(true).build(),
    ];
    repository.items = items;

    let output = await useCase.execute({
      page: 1,
      per_page: 2,
      sort: "name",
      filter: { name: "AA" },
    });

    // O filtro 'AA' é case-insensitive, então retorna 'AAA' e 'AaA'
    // 2 itens passam no filtro, ordenados por nome: AAA, AaA
    expect(output).toStrictEqual({
      items: [items[1], items[2]].map(MusicianOutputMapper.toOutput), // AAA, AaA
      total: 2, // 2 itens passam no filtro
      current_page: 1,
      per_page: 2,
      last_page: 1, // 2 itens / 2 por página = 1 página
    });

    output = await useCase.execute({
      page: 2,
      per_page: 2,
      sort: "name",
      filter: { name: "a" },
    });
    // Filtro 'a' encontra: AAA, AaA, charlie (3 itens)
    // Ordenados por nome: AAA, AaA, charlie
    // Página 2 com 2 por página: charlie
    expect(output).toStrictEqual({
      items: [items[4]].map(MusicianOutputMapper.toOutput),
      total: 3,
      current_page: 2,
      per_page: 2,
      last_page: 2,
    });

    output = await useCase.execute({
      page: 1,
      per_page: 2,
      sort: "name",
      sort_dir: "desc",
      filter: { name: "a" },
    });
    // Filtro 'a' encontra: AAA, AaA, charlie (3 itens)
    // Ordenados por nome desc: charlie, AaA, AAA
    // Página 1 com 2 por página: charlie, AaA
    expect(output).toStrictEqual({
      items: [items[4], items[2]].map(MusicianOutputMapper.toOutput),
      total: 3,
      current_page: 1,
      per_page: 2,
      last_page: 2,
    });
  });

  it("should filter output using price range", async () => {
    const created_at = new Date(2024, 1, 1);

    const items = [
      Musician.fake()
        .aMusician()
        .withName("m1")
        .withOpenToGigs(true)
        .withcreated_at(new Date(created_at.getTime() + 100))
        .build(),
      Musician.fake()
        .aMusician()
        .withName("m2")
        .withOpenToGigs(true)
        .withcreated_at(new Date(created_at.getTime() + 200))
        .build(),
      Musician.fake()
        .aMusician()
        .withName("m3")
        .withOpenToGigs(true)
        .withcreated_at(new Date(created_at.getTime() + 300))
        .build(),
    ];

    items[0].updatePriceRanges([new PriceRange({ model: "per_event", min: 100, max: 200 })]);
    items[1].updatePriceRanges([new PriceRange({ model: "per_event", min: 300, max: 400 })]);

    repository.items = items;

    const output = await useCase.execute({
      sort: "created_at",
      sort_dir: "asc",
      filter: { price_min: 250 },
    });

    expect(output).toStrictEqual({
      items: [items[1]].map(MusicianOutputMapper.toOutput),
      total: 1,
      current_page: 1,
      per_page: 15,
      last_page: 1,
    });
  });

  it("never lets the caller override the open_to_gigs consent gate", async () => {
    const optedIn = Musician.fake().aMusician().withOpenToGigs(true).build();
    const optedOut = Musician.fake().aMusician().withOpenToGigs(false).build();
    const undecided = Musician.fake().aMusician().withOpenToGigs(null).build();
    repository.items = [optedIn, optedOut, undecided];

    const output = await useCase.execute({
      filter: { open_to_gigs: false } as any,
    });

    expect(output.items).toEqual([MusicianOutputMapper.toOutput(optedIn)]);
    expect(output.total).toBe(1);
  });
});
