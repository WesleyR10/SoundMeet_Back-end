import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { IMusicLibraryRepository } from "../../../../music-library/domain/music-library.repository";
import { MusicLibraryId } from "../../../../music-library/domain/music-library.aggregate";
import { Repertoire, RepertoireId } from "../../../domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../domain/repertoire.repository";
import {
  MusicLibraryBasicData,
  RepertoireOutput,
  RepertoireOutputMapper,
} from "../common/repertoire-output";

export type GetRepertoireInput = {
  repertoire_id: string;
  requesting_musician_id?: string;
};

export class GetRepertoireUseCase
  implements IUseCase<GetRepertoireInput, RepertoireOutput>
{
  constructor(
    private readonly repertoireRepo: IRepertoireRepository,
    private readonly musicLibraryRepo: IMusicLibraryRepository,
  ) {}

  async execute(input: GetRepertoireInput): Promise<RepertoireOutput> {
    const id = new RepertoireId(input.repertoire_id);
    const repertoire = await this.repertoireRepo.findById(id);
    if (!repertoire) {
      throw new NotFoundError(input.repertoire_id, Repertoire);
    }

    const musicLibraryMap = await this.buildMusicLibraryMap(repertoire);
    const isOwner = !input.requesting_musician_id || input.requesting_musician_id === repertoire.musician_id;

    return RepertoireOutputMapper.toOutput(repertoire, musicLibraryMap, isOwner);
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
