import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { InvalidUuidError } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Musician, MusicianId } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import {
  ListMusicianIdentitiesUseCase,
  MUSICIAN_IDENTITIES_MAX,
} from "../list-musician-identities.use-case";

describe("ListMusicianIdentitiesUseCase", () => {
  let repository: MusicianInMemoryRepository;
  let useCase: ListMusicianIdentitiesUseCase;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    useCase = new ListMusicianIdentitiesUseCase(repository);
  });

  it("resolve vários ids numa consulta só, na ordem pedida", async () => {
    const carlao = Musician.fake()
      .aMusician()
      .withName("Carlos Teclas")
      .withStageName("Carlão do Piano")
      .withInstruments(["Piano"])
      .build();
    const diego = Musician.fake()
      .aMusician()
      .withName("Diego Eletrônico")
      .withStageName(null)
      .build();
    await repository.bulkInsert([carlao, diego]);
    const spy = jest.spyOn(repository, "findIdentitiesByIds");

    const output = await useCase.execute({
      ids: [diego.musician_id.id, carlao.musician_id.id],
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(output.items.map((item) => item.display_name)).toEqual([
      "Diego Eletrônico",
      "Carlão do Piano",
    ]);
    expect(output.items[1]).toStrictEqual({
      id: carlao.musician_id.id,
      display_name: "Carlão do Piano",
      avatar: carlao.avatar,
      instruments: ["Piano"],
      genres: carlao.genres,
      rating: carlao.rating.value,
      total_ratings: carlao.total_ratings,
      is_verified: false,
    });
  });

  /*
   * O cartão é de IDENTIDADE. Nada de contato, endereço, preço ou plano — é
   * por não carregar isso que a consulta é barata e a rota pode ser anônima.
   */
  it("não devolve nada além da identidade", async () => {
    const musician = Musician.fake()
      .aMusician()
      .withEmail("segredo@example.com")
      .withPhone("11999990001")
      .build();
    await repository.insert(musician);

    const output = await useCase.execute({ ids: [musician.musician_id.id] });

    expect(Object.keys(output.items[0]).sort()).toEqual([
      "avatar",
      "display_name",
      "genres",
      "id",
      "instruments",
      "is_verified",
      "rating",
      "total_ratings",
    ]);
    expect(JSON.stringify(output)).not.toContain("segredo@example.com");
  });

  it("resolve músico com o radar DESLIGADO e desativado: não é descoberta", async () => {
    const hidden = Musician.fake()
      .aMusician()
      .withOpenToGigs(false)
      .deactivate()
      .build();
    await repository.insert(hidden);

    const output = await useCase.execute({ ids: [hidden.musician_id.id] });

    expect(output.items).toHaveLength(1);
  });

  it("id inexistente não volta e não derruba os outros", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);

    const output = await useCase.execute({
      ids: [new MusicianId().id, musician.musician_id.id],
    });

    expect(output.items.map((item) => item.id)).toEqual([
      musician.musician_id.id,
    ]);
  });

  it("id repetido custa uma linha só", async () => {
    const musician = Musician.fake().aMusician().build();
    await repository.insert(musician);
    const id = musician.musician_id.id;

    const output = await useCase.execute({ ids: [id, id, id] });

    expect(output.items).toHaveLength(1);
  });

  it("lista vazia não consulta o repositório", async () => {
    const spy = jest.spyOn(repository, "findIdentitiesByIds");

    await expect(useCase.execute({ ids: [] })).resolves.toEqual({ items: [] });
    expect(spy).not.toHaveBeenCalled();
  });

  it(`recusa mais de ${MUSICIAN_IDENTITIES_MAX} ids distintos`, async () => {
    const ids = Array.from(
      { length: MUSICIAN_IDENTITIES_MAX + 1 },
      () => new MusicianId().id,
    );

    await expect(useCase.execute({ ids })).rejects.toThrow(
      EntityValidationError,
    );
  });

  it("id que não é UUID é recusado", async () => {
    await expect(useCase.execute({ ids: ["nao-e-uuid"] })).rejects.toThrow(
      InvalidUuidError,
    );
  });
});
