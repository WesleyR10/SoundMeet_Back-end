import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidOperationError } from "../../../../shared/domain/errors/invalid-operation.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { IMusicLibraryRepository } from "../../../../music-library/domain/music-library.repository";
import { MusicLibraryId } from "../../../../music-library/domain/music-library.aggregate";
import { Repertoire } from "../../../domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../domain/repertoire.repository";
import {
  MusicLibraryBasicData,
  RepertoireOutput,
  RepertoireOutputMapper,
} from "../common/repertoire-output";

export type GetSharedRepertoireInput = { token: string };

export class GetSharedRepertoireUseCase
  implements IUseCase<GetSharedRepertoireInput, RepertoireOutput>
{
  constructor(
    private readonly repertoireRepo: IRepertoireRepository,
    private readonly musicLibraryRepo: IMusicLibraryRepository,
  ) {}

  async execute(input: GetSharedRepertoireInput): Promise<RepertoireOutput> {
    const repertoire = await this.repertoireRepo.findByShareToken(input.token);
    if (!repertoire) {
      throw new NotFoundError(input.token, Repertoire);
    }

    if (!repertoire.isShareTokenValid()) {
      throw new InvalidOperationError("O link de compartilhamento expirou ou foi desativado.");
    }

    const musicLibraryMap = await this.buildMusicLibraryMap(repertoire);
    return RepertoireOutputMapper.toOutput(repertoire, musicLibraryMap, false);
  }

  private async buildMusicLibraryMap(
    repertoire: Repertoire,
  ): Promise<Map<string, MusicLibraryBasicData>> {
    const map = new Map<string, MusicLibraryBasicData>();
    if (repertoire.songs.length === 0) return map;

    const ids = repertoire.songs.map((s) => new MusicLibraryId(s.music_library_id));
    const entries = await this.musicLibraryRepo.findByIds(ids);

    for (const entry of entries) {
      map.set(entry.music_library_id.id, {
        id: entry.music_library_id.id,
        title: entry.title,
        artist: entry.artist,
        duration_seconds: entry.duration_seconds,
      });
    }
    return map;
  }
}
