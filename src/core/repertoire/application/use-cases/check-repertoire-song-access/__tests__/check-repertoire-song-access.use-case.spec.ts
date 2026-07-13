import { ForbiddenException } from "@nestjs/common";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Repertoire, RepertoireSong } from "../../../../domain/repertoire.aggregate";
import { RepertoireInMemoryRepository } from "../../../../infra/db/in-memory/repertoire-in-memory.repository";
import { CheckRepertoireSongAccessUseCase } from "../check-repertoire-song-access.use-case";

describe("CheckRepertoireSongAccessUseCase", () => {
  let repo: RepertoireInMemoryRepository;
  let useCase: CheckRepertoireSongAccessUseCase;

  beforeEach(() => {
    repo = new RepertoireInMemoryRepository();
    useCase = new CheckRepertoireSongAccessUseCase(repo);
  });

  it("autoriza o dono do repertório", async () => {
    const ownerId = new Uuid().id;
    const musicLibraryId = new Uuid().id;
    const repertoire = Repertoire.create({ musician_id: ownerId, name: "Setlist" });
    repertoire.addSong(RepertoireSong.create({ music_library_id: musicLibraryId }));
    await repo.insert(repertoire);

    const output = await useCase.execute({
      repertoire_id: repertoire.repertoire_id.id,
      requesting_musician_id: ownerId,
      music_library_id: musicLibraryId,
    });

    expect(output).toEqual({ owner_musician_id: ownerId });
  });

  it("autoriza um convidado nominal listado no repertório", async () => {
    const ownerId = new Uuid().id;
    const inviteeId = new Uuid().id;
    const musicLibraryId = new Uuid().id;
    const repertoire = Repertoire.create({ musician_id: ownerId, name: "Setlist" });
    repertoire.addSong(RepertoireSong.create({ music_library_id: musicLibraryId }));
    repertoire.inviteMusician(inviteeId);
    await repo.insert(repertoire);

    const output = await useCase.execute({
      repertoire_id: repertoire.repertoire_id.id,
      requesting_musician_id: inviteeId,
      music_library_id: musicLibraryId,
    });

    expect(output).toEqual({ owner_musician_id: ownerId });
  });

  it("bloqueia músico que não é dono nem convidado", async () => {
    const ownerId = new Uuid().id;
    const strangerId = new Uuid().id;
    const musicLibraryId = new Uuid().id;
    const repertoire = Repertoire.create({ musician_id: ownerId, name: "Setlist" });
    repertoire.addSong(RepertoireSong.create({ music_library_id: musicLibraryId }));
    await repo.insert(repertoire);

    await expect(
      useCase.execute({
        repertoire_id: repertoire.repertoire_id.id,
        requesting_musician_id: strangerId,
        music_library_id: musicLibraryId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("bloqueia convidado válido pedindo música que não está no repertório", async () => {
    const ownerId = new Uuid().id;
    const inviteeId = new Uuid().id;
    const otherMusicLibraryId = new Uuid().id;
    const repertoire = Repertoire.create({ musician_id: ownerId, name: "Setlist" });
    repertoire.inviteMusician(inviteeId);
    await repo.insert(repertoire);

    await expect(
      useCase.execute({
        repertoire_id: repertoire.repertoire_id.id,
        requesting_musician_id: inviteeId,
        music_library_id: otherMusicLibraryId,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lança NotFoundError se o repertório não existir", async () => {
    await expect(
      useCase.execute({
        repertoire_id: new Uuid().id,
        requesting_musician_id: new Uuid().id,
        music_library_id: new Uuid().id,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
