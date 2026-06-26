import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IMusicLibraryRepository } from "../../../../music-library/domain/music-library.repository";
import { MusicLibraryId } from "../../../../music-library/domain/music-library.aggregate";
import { Repertoire } from "../../../domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../domain/repertoire.repository";
import {
  MusicLibraryBasicData,
  RepertoireOutput,
  RepertoireOutputMapper,
} from "../common/repertoire-output";

export type ListMyInvitesInput = { musician_id: string };
export type ListMyInvitesOutput = RepertoireOutput[];

export class ListMyInvitesUseCase
  implements IUseCase<ListMyInvitesInput, ListMyInvitesOutput>
{
  constructor(
    private readonly repertoireRepo: IRepertoireRepository,
    private readonly musicLibraryRepo: IMusicLibraryRepository,
  ) {}

  async execute(input: ListMyInvitesInput): Promise<ListMyInvitesOutput> {
    const repertoires = await this.repertoireRepo.findSharedWithMusician(input.musician_id);
    return Promise.all(
      repertoires.map(async (r) => {
        const map = await this.buildMusicLibraryMap(r);
        return RepertoireOutputMapper.toOutput(r, map, false);
      }),
    );
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
