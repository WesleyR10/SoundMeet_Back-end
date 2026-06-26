import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { IMusicLibraryRepository } from "../../../../music-library/domain/music-library.repository";
import {
  MusicLibrary,
  MusicLibraryId,
} from "../../../../music-library/domain/music-library.aggregate";
import { Repertoire, RepertoireId, RepertoireSong } from "../../../domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../domain/repertoire.repository";
import {
  MusicLibraryBasicData,
  RepertoireOutput,
  RepertoireOutputMapper,
} from "../common/repertoire-output";

export type AddSongInput = {
  repertoire_id: string;
  music_library_id: string;
  custom_notes?: string | null;
  duration_override_seconds?: number | null;
};

export class AddSongUseCase implements IUseCase<AddSongInput, RepertoireOutput> {
  constructor(
    private readonly repertoireRepo: IRepertoireRepository,
    private readonly musicLibraryRepo: IMusicLibraryRepository,
    private readonly planCheckService: PlanCheckService,
  ) {}

  async execute(input: AddSongInput): Promise<RepertoireOutput> {
    const id = new RepertoireId(input.repertoire_id);
    const repertoire = await this.repertoireRepo.findById(id);
    if (!repertoire) {
      throw new NotFoundError(input.repertoire_id, Repertoire);
    }

    await this.planCheckService.assertMusicianCanAddSongToRepertoire(
      repertoire.musician_id,
      repertoire.songs.length,
    );

    const mlId = new MusicLibraryId(input.music_library_id);
    const musicLibrary = await this.musicLibraryRepo.findById(mlId);
    if (!musicLibrary) {
      throw new NotFoundError(input.music_library_id, MusicLibrary);
    }

    if (musicLibrary.musician_id.id !== repertoire.musician_id) {
      throw new EntityValidationError([
        { music_library_id: ["Esta música não pertence ao músico dono do repertório."] },
      ]);
    }

    const song = RepertoireSong.create({
      music_library_id: input.music_library_id,
      custom_notes: input.custom_notes ?? null,
      duration_override_seconds: input.duration_override_seconds ?? null,
    });

    repertoire.addSong(song);
    await this.repertoireRepo.update(repertoire);

    // Carrega dados de TODAS as músicas do repertório para o output enriquecido
    const musicLibraryMap = new Map<string, MusicLibraryBasicData>();
    const allIds = repertoire.songs.map((s) => new MusicLibraryId(s.music_library_id));
    const allEntries = await this.musicLibraryRepo.findByIds(allIds);
    for (const entry of allEntries) {
      musicLibraryMap.set(entry.music_library_id.id, {
        id: entry.music_library_id.id,
        title: entry.title,
        artist: entry.artist,
        duration_seconds: entry.duration_seconds,
      });
    }

    return RepertoireOutputMapper.toOutput(repertoire, musicLibraryMap);
  }
}
