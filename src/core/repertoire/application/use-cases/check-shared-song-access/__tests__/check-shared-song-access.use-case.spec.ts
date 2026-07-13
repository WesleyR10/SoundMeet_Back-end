import { InvalidOperationError } from "../../../../../shared/domain/errors/invalid-operation.error";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Repertoire, RepertoireSong } from "../../../../domain/repertoire.aggregate";
import { RepertoireFakeBuilder } from "../../../../domain/repertoire-fake.builder";
import { RepertoireInMemoryRepository } from "../../../../infra/db/in-memory/repertoire-in-memory.repository";
import { CheckSharedSongAccessUseCase } from "../check-shared-song-access.use-case";

describe("CheckSharedSongAccessUseCase", () => {
  let repo: RepertoireInMemoryRepository;
  let useCase: CheckSharedSongAccessUseCase;

  beforeEach(() => {
    repo = new RepertoireInMemoryRepository();
    useCase = new CheckSharedSongAccessUseCase(repo);
  });

  it("autoriza acesso via token válido e música pertencente ao repertório", async () => {
    const ownerId = new Uuid().id;
    const musicLibraryId = new Uuid().id;
    const repertoire = Repertoire.create({ musician_id: ownerId, name: "Setlist" });
    repertoire.addSong(RepertoireSong.create({ music_library_id: musicLibraryId }));
    repertoire.share();
    await repo.insert(repertoire);

    const output = await useCase.execute({
      share_token: repertoire.share_token!,
      music_library_id: musicLibraryId,
    });

    expect(output).toEqual({ owner_musician_id: ownerId });
  });

  it("lança NotFoundError pra token inexistente", async () => {
    await expect(
      useCase.execute({ share_token: new Uuid().id, music_library_id: new Uuid().id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lança InvalidOperationError se o token existe mas já expirou", async () => {
    const ownerId = new Uuid().id;
    const musicLibraryId = new Uuid().id;
    const expiredToken = new Uuid().id;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const repertoire = RepertoireFakeBuilder.aRepertoire()
      .withMusicianId(ownerId)
      .withIsShared(true)
      .withShareToken(expiredToken)
      .withShareTokenExpiresAt(yesterday)
      .build();
    repertoire.addSong(RepertoireSong.create({ music_library_id: musicLibraryId }));
    await repo.insert(repertoire);

    await expect(
      useCase.execute({ share_token: expiredToken, music_library_id: musicLibraryId }),
    ).rejects.toBeInstanceOf(InvalidOperationError);
  });

  it("lança NotFoundError se a música não pertencer ao repertório compartilhado", async () => {
    const ownerId = new Uuid().id;
    const repertoire = Repertoire.create({ musician_id: ownerId, name: "Setlist" });
    repertoire.share();
    await repo.insert(repertoire);

    await expect(
      useCase.execute({ share_token: repertoire.share_token!, music_library_id: new Uuid().id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
