import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import {
  InvalidUuidError,
  Uuid,
} from "../../../../../shared/domain/value-objects/uuid.vo";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { DeleteMusicianInput } from "../delete-musician.input";
import { DeleteMusicianUseCase } from "../delete-musician.use-case";

describe("DeleteMusicianUseCase Unit Tests", () => {
  let useCase: DeleteMusicianUseCase;
  let repository: MusicianInMemoryRepository;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    useCase = new DeleteMusicianUseCase(repository);
  });

  it("should throw error when entity not found", async () => {
    const musicianId = new Uuid();
    const input: DeleteMusicianInput = {
      id: musicianId.id,
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(musicianId.id, Musician),
    );
  });

  it("should throw error when id is not valid", async () => {
    const input: DeleteMusicianInput = {
      id: "invalid-id",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  it("should delete a musician", async () => {
    const spyDelete = jest.spyOn(repository, "delete");
    const musician = Musician.fake().aMusician().build();
    repository.items = [musician];

    const input: DeleteMusicianInput = {
      id: musician.musician_id.id,
    };

    await useCase.execute(input);

    expect(spyDelete).toHaveBeenCalledTimes(1);
    expect(repository.items).toHaveLength(0);
  });

  it("should delete the correct musician when multiple exist", async () => {
    const musician1 = Musician.fake().aMusician().build();
    const musician2 = Musician.fake().aMusician().build();
    const musician3 = Musician.fake().aMusician().build();
    repository.items = [musician1, musician2, musician3];

    const input: DeleteMusicianInput = {
      id: musician2.musician_id.id,
    };

    await useCase.execute(input);

    expect(repository.items).toHaveLength(2);
    expect(repository.items).toEqual([musician1, musician3]);
    expect(
      repository.items.find((m) => m.musician_id.equals(musician2.musician_id)),
    ).toBeUndefined();
  });

  it("should call repository delete method with correct musician id", async () => {
    const spyDelete = jest.spyOn(repository, "delete");
    const musician = Musician.fake().aMusician().build();
    repository.items = [musician];

    const input: DeleteMusicianInput = {
      id: musician.musician_id.id,
    };

    await useCase.execute(input);

    expect(spyDelete).toHaveBeenCalledWith(musician.musician_id);
  });
});
