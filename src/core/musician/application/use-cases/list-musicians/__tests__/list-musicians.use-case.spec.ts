import { Location } from "../../../../../shared/domain/value-objects/location.vo";
import { PriceRange } from "../../../../../shared/domain/value-objects/price-range.vo";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianSearchResult } from "../../../../domain/musician.repository";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { MusicianOutputMapper } from "../../common/musician-profile-output";
import { ListMusiciansUseCase } from "../list-musicians.use-case";

/** Item da LISTA: o output do músico mais a distância (nula sem origem). */
const toListOutput = (entity: Musician) => ({
  ...MusicianOutputMapper.toOutput(entity),
  distance_km: null,
});

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
      items: [entity].map(toListOutput),
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
      items: [...items].reverse().map(toListOutput),
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
      Musician.fake()
        .aMusician()
        .withName("charlie")
        .withOpenToGigs(true)
        .build(),
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
      items: [items[1], items[2]].map(toListOutput), // AAA, AaA
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
      items: [items[4]].map(toListOutput),
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
      items: [items[4], items[2]].map(toListOutput),
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

    items[0].updatePriceRanges([
      new PriceRange({ model: "per_event", min: 100, max: 200 }),
    ]);
    items[1].updatePriceRanges([
      new PriceRange({ model: "per_event", min: 300, max: 400 }),
    ]);

    repository.items = items;

    const output = await useCase.execute({
      sort: "created_at",
      sort_dir: "asc",
      filter: { price_min: 250 },
    });

    expect(output).toStrictEqual({
      items: [items[1]].map(toListOutput),
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

    expect(output.items).toEqual([toListOutput(optedIn)]);
    expect(output.total).toBe(1);
  });

  /*
   * 🔴 A busca só aplicava o gate de consentimento. Músico desativado seguia
   * na grade das casas e no Explorar do fã, embora pedido, scan de QR e
   * convite de banda já o recusassem.
   */
  it("never lists a deactivated musician, even if the caller asks for it", async () => {
    const active = Musician.fake().aMusician().withOpenToGigs(true).build();
    const inactive = Musician.fake()
      .aMusician()
      .withOpenToGigs(true)
      .deactivate()
      .build();
    repository.items = [active, inactive];

    const byDefault = await useCase.execute({});
    const asked = await useCase.execute({
      filter: { is_active: false } as any,
    });

    expect(byDefault.items.map((item) => item.id)).toEqual([
      active.musician_id.id,
    ]);
    expect(asked.items.map((item) => item.id)).toEqual([active.musician_id.id]);
  });

  describe("distância até a origem da busca", () => {
    const at = (name: string, latitude: number, longitude: number) => {
      const musician = Musician.fake()
        .aMusician()
        .withName(name)
        .withOpenToGigs(true)
        .build();
      musician
        .ensureProfile()
        .changeLocation(
          new Location({ city: "São Paulo", state: "SP", latitude, longitude }),
        );
      return musician;
    };

    it("com origem, cada item leva km INTEIROS", async () => {
      repository.items = [at("Perto", -23.5614, -46.6559)];

      const output = await useCase.execute({
        filter: { lat: -23.5338, lng: -46.6559 } as any,
      });

      expect(output.items[0].distance_km).toBe(3);
      expect(Number.isInteger(output.items[0].distance_km)).toBe(true);
    });

    it("sem origem, a distância é nula — nunca zero", async () => {
      repository.items = [at("Perto", -23.5614, -46.6559)];

      const output = await useCase.execute({});

      expect(output.items[0].distance_km).toBeNull();
    });

    it("músico sem coordenada fica com distância nula mesmo com origem", async () => {
      const semCoordenada = Musician.fake()
        .aMusician()
        .withOpenToGigs(true)
        .build();
      repository.items = [semCoordenada];

      const output = await useCase.execute({
        filter: { lat: -23.5338, lng: -46.6559 } as any,
      });

      expect(output.items[0].distance_km).toBeNull();
    });

    /*
     * 🔴 A distância NÃO pode separar duas casas da mesma célula da grade: se
     * separasse, mover a origem e repetir a busca apontaria a porta.
     */
    it("duas casas na mesma célula recebem a mesma distância, de qualquer origem", async () => {
      repository.items = [
        at("Casa A", -23.5628, -46.654),
        at("Casa B", -23.5571, -46.6492),
      ];

      for (const origin of [
        { lat: -23.5538, lng: -46.654 },
        { lat: -23.5201, lng: -46.7003 },
        { lat: -23.61, lng: -46.6 },
      ]) {
        const output = await useCase.execute({ filter: origin as any });
        const [first, second] = output.items.map((item) => item.distance_km);

        expect(first).toBe(second);
      }
    });
  });
});
