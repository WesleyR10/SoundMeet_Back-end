import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianSearchResult } from "../../../../domain/musician.repository";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { MusicianOutputMapper } from "../../common/musician-output";
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
      Musician.fake().aMusician().build(),
      Musician.fake()
        .aMusician()
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
      Musician.fake().aMusician().withName("test").build(),
      Musician.fake().aMusician().withName("AAA").build(),
      Musician.fake().aMusician().withName("AaA").build(),
      Musician.fake().aMusician().withName("bob").build(),
      Musician.fake().aMusician().withName("charlie").build(),
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
});
