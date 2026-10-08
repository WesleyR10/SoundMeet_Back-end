import { ResolveSpotifyTrackUseCase } from "../../../../music-library/application/use-cases/resolve-spotify-track/resolve-spotify-track.use-case";
import { UpdateMusicLibraryUseCase } from "../../../../music-library/application/use-cases/update-music-library/update-music-library.use-case";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  AiCifraAnalysisJob,
  AiCifraAnalysisJobId,
  AiCifraAnalysisResult,
} from "../../../domain/ai-cifra-analysis-job.aggregate";
import { IAiCifraAnalysisJobRepository } from "../../../domain/ai-cifra-analysis-job.repository";
import { AiCifraUploadId } from "../../../domain/ai-cifra-upload.aggregate";
import { IAiCifraUploadRepository } from "../../../domain/ai-cifra-upload.repository";
import { IAiCifraStorage } from "../../ports/ai-cifra-storage.interface";
import { CompleteAiCifraAnalysisJobInput } from "./complete-ai-cifra-analysis-job.input";

export class CompleteAiCifraAnalysisJobUseCase implements IUseCase<
  CompleteAiCifraAnalysisJobInput,
  void
> {
  constructor(
    private readonly uploadRepo: IAiCifraUploadRepository,
    private readonly jobRepo: IAiCifraAnalysisJobRepository,
    private readonly storage: IAiCifraStorage,
    private readonly updateMusicLibraryUseCase?: UpdateMusicLibraryUseCase,
    // Mesmo racional do gêmeo síncrono (ProcessAiCifraAnalysisJobUseCase) --
    // ver comentário lá. Precisa estar aqui também porque este é o caminho
    // de conclusão usado quando o worker chama de volta via
    // POST /ai-cifra/internal/analyses/:id/complete.
    private readonly alignSyncedLyricsUseCase?: {
      execute(input: {
        music_library_id: string;
        audio_object_key: string;
      }): Promise<void>;
    },
    // Último de propósito: os parâmetros deste construtor são posicionais e já
    // têm chamadores. Inserir no meio reatribui silenciosamente os argumentos
    // de quem já constrói a classe.
    private readonly resolveSpotifyTrackUseCase?: ResolveSpotifyTrackUseCase,
  ) {}

  async execute(input: CompleteAiCifraAnalysisJobInput): Promise<void> {
    const job = await this.jobRepo.findById(
      new AiCifraAnalysisJobId(input.job_id),
    );
    if (!job) {
      throw new NotFoundError(input.job_id, AiCifraAnalysisJob);
    }

    if (job.status === "completed" || job.status === "failed") {
      return;
    }

    const upload = await this.uploadRepo.findById(
      new AiCifraUploadId(job.ai_cifra_upload_id.id),
    );
    if (!upload) {
      job.fail("UPLOAD_NOT_FOUND", "Upload não encontrado para este job");
      await this.jobRepo.update(job);
      return;
    }

    const result = new AiCifraAnalysisResult({
      bpm: typeof input.bpm === "number" ? input.bpm : null,
      key: input.key ?? null,
      time_signature: input.time_signature ?? null,
      chords: Array.isArray(input.chords) ? input.chords : [],
      segments: Array.isArray(input.segments) ? input.segments : [],
      artifacts: input.artifacts ?? null,
    });

    job.complete(result);
    if (job.notification.hasErrors()) {
      throw new EntityValidationError(job.notification.toJSON());
    }

    upload.markAnalyzed();
    if (upload.notification.hasErrors()) {
      throw new EntityValidationError(upload.notification.toJSON());
    }

    await this.jobRepo.update(job);
    await this.uploadRepo.update(upload);

    // Ponte pipeline → catálogo: sem isso, o resultado da análise fica preso
    // no aggregate do job e GET /music-library/:id/chord-sheet nunca vê os
    // acordes/estrutura recém-gerados (ele lê direto de MusicLibrary.chords/
    // structure_segments/bpm/key, não do job). Best-effort: uma falha aqui não
    // deve reverter a conclusão do job em si (já persistido acima).
    if (this.updateMusicLibraryUseCase && upload.music_library_id) {
      await this.updateMusicLibraryUseCase
        .execute({
          id: upload.music_library_id.id,
          is_admin: true,
          chords: result.chords,
          structure_segments: result.segments,
          bpm: result.bpm,
          key: result.key,
          duration_seconds: this.extractDurationSeconds(result.artifacts),
        })
        .catch(() => undefined);
    }

    // Faixa correspondente no Spotify — DEPOIS do update acima, que é quem
    // grava `duration_seconds`. Invertido, o matcher rodaria sem o único sinal
    // que separa estúdio de ao vivo e cairia no score neutro de duração.
    //
    // Best-effort pelo mesmo motivo dos vizinhos: o link é conveniência, a
    // cifra é o produto. Spotify fora do ar não pode falhar uma análise que
    // levou minutos de GPU.
    if (this.resolveSpotifyTrackUseCase && upload.music_library_id) {
      await this.resolveSpotifyTrackUseCase
        .execute({ music_library_id: upload.music_library_id.id })
        .catch(() => undefined);
    }

    if (this.alignSyncedLyricsUseCase && upload.music_library_id) {
      await this.alignSyncedLyricsUseCase
        .execute({
          music_library_id: upload.music_library_id.id,
          audio_object_key: upload.object_key,
        })
        .catch(() => undefined);
    }

    await this.storage
      .deleteObject({ object_key: upload.object_key })
      .catch(() => undefined);
  }

  // Mesmo racional do gêmeo síncrono (ProcessAiCifraAnalysisJobUseCase) --
  // ver comentário lá.
  private extractDurationSeconds(
    artifacts: Record<string, any> | null | undefined,
  ): number | null {
    const value = artifacts?.duration_seconds;
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : null;
  }
}
