import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { bandLedBy, bandMember } from "../../common/__tests__/band-fixtures";
import {
  BAND_IDENTITIES_MAX,
  ListBandIdentitiesUseCase,
} from "../list-band-identities.use-case";

describe("ListBandIdentitiesUseCase Unit Tests", () => {
  let useCase: ListBandIdentitiesUseCase;
  let repository: BandInMemoryRepository;

  beforeEach(() => {
    repository = new BandInMemoryRepository();
    useCase = new ListBandIdentitiesUseCase(repository);
  });

  it("devolve só nome, foto, gêneros e instrumentos — nada de endereço, preço ou convites", async () => {
    const band = bandLedBy(new Uuid(), [
      bandMember(new Uuid(), "member", "accepted", "Baixo"),
      bandMember(new Uuid(), "member", "accepted", "Baixo"),
      bandMember(new Uuid(), "member", "pending", "Bateria"),
    ]);
    repository.items = [band];

    const output = await useCase.execute({ ids: [band.band_id.id] });

    expect(output.items).toHaveLength(1);
    expect(Object.keys(output.items[0]).sort()).toEqual([
      "avatar",
      "display_name",
      "genres",
      "id",
      "instruments",
    ]);
    expect(output.items[0]).toMatchObject({
      id: band.band_id.id,
      display_name: band.name,
      // Sem repetir, e só de quem aceitou: convite pendente não toca na banda.
      instruments: ["guitar", "Baixo"],
    });
  });

  it("não lista o marcador 'N/A' do líder como instrumento", async () => {
    const band = bandLedBy(new Uuid());
    band.members[0].instrument = "N/A";
    repository.items = [band];

    const output = await useCase.execute({ ids: [band.band_id.id] });

    expect(output.items[0].instruments).toEqual([]);
  });

  it("resolve banda fora do radar e banda arquivada: quem tem o id precisa do nome", async () => {
    const offRadar = bandLedBy(new Uuid());
    const archived = bandLedBy(new Uuid());
    archived.archive();
    repository.items = [offRadar, archived];

    const output = await useCase.execute({
      ids: [archived.band_id.id, offRadar.band_id.id],
    });

    // Na ordem pedida.
    expect(output.items.map((item) => item.id)).toEqual([
      archived.band_id.id,
      offRadar.band_id.id,
    ]);
  });

  it("id que não existe simplesmente não volta", async () => {
    const band = bandLedBy(new Uuid());
    repository.items = [band];

    const output = await useCase.execute({
      ids: [new Uuid().id, band.band_id.id, band.band_id.id],
    });

    expect(output.items.map((item) => item.id)).toEqual([band.band_id.id]);
  });

  it("recusa mais ids do que o teto", async () => {
    const ids = Array.from(
      { length: BAND_IDENTITIES_MAX + 1 },
      () => new Uuid().id,
    );

    await expect(useCase.execute({ ids })).rejects.toThrow(
      EntityValidationError,
    );
  });

  it("lista vazia não consulta o banco", async () => {
    const findByIds = jest.spyOn(repository, "findByIds");

    await expect(useCase.execute({ ids: [] })).resolves.toEqual({ items: [] });
    expect(findByIds).not.toHaveBeenCalled();
  });
});
