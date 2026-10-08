import { UpdateMusicLibraryUseCase } from "../../../../music-library/application/use-cases/update-music-library/update-music-library.use-case";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { DomainError } from "../../../../shared/domain/errors/domain.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  AiCifraAnalysisJob,
  AiCifraAnalysisJobId,
  AiCifraAnalysisResult,
} from "../../../domain/ai-cifra-analysis-job.aggregate";
import { IAiCifraAnalysisJobRepository } from "../../../domain/ai-cifra-analysis-job.repository";
import { AiCifraUploadId } from "../../../domain/ai-cifra-upload.aggregate";
import { IAiCifraUploadRepository } from "../../../domain/ai-cifra-upload.repository";
import { IAiCifraAnalysisClient } from "../../ports/ai-cifra-analysis-client.interface";
import { IAiCifraStorage } from "../../ports/ai-cifra-storage.interface";
import { ProcessAiCifraAnalysisJobInput } from "./process-ai-cifra-analysis-job.input";

export class AiCifraAnalysisRetryableError extends DomainError {
  constructor(
    public readonly code: string,
    message: string,
    cause?: unknown,
  ) {
    super(message, {
      cause,
      metadata: {
        code,
      },
    });
  }
}

export class ProcessAiCifraAnalysisJobUseCase implements IUseCase<
  ProcessAiCifraAnalysisJobInput,
  void
> {
  constructor(
    private readonly uploadRepo: IAiCifraUploadRepository,
    private readonly jobRepo: IAiCifraAnalysisJobRepository,
    private readonly client: IAiCifraAnalysisClient,
    private readonly storage: IAiCifraStorage,
    private readonly musicLibraryLookup?: {
      findById(id: string): Promise<{ title?: string; artist?: string } | null>;
    },
    // Ponte pipeline -> catálogo (mesmo racional do item 6.5/roadmap.md,
    // aplicado aqui pela primeira vez): SEM ISTO, este caminho -- o usado
    // por padrão via AI_CIFRA_PROCESSING_TRANSPORT=http, o valor default em
    // envs/.env.example -- nunca escrevia bpm/key/chords/structure_segments
    // de volta em MusicLibrary, só no aggregate AiCifraAnalysisJob.result.
    // GET .../chord-sheet lê direto de MusicLibrary, não do job -- ou seja,
    // completar uma análise por este caminho nunca preenchia a cifra de
    // verdade. O item 6.5 só corrigiu isso no caminho irmão
    // (CompleteAiCifraAnalysisJobUseCase, usado pelo callback interno do
    // worker) -- este aqui, o caminho síncrono/primário, tinha ficado de
    // fora. Best-effort: falha aqui não desfaz a conclusão do job.
    private readonly updateMusicLibraryUseCase?: UpdateMusicLibraryUseCase,
    // Alinhamento forçado letra<->áudio (MMS_FA, ver
    // Docs/ia-musical/folha-de-cifra.md) -- best-effort, chamado só se a letra
    // JÁ estiver sincronizada nesse exato momento, porque upload.object_key
    // está prestes a ser apagado do storage logo abaixo e não há retentativa
    // depois. Se a letra ainda não existir, o use-case interno já faz no-op
    // sozinho (ver AlignSyncedLyricsWordTimestampsUseCase) -- não precisa de
    // checagem extra aqui.
    private readonly alignSyncedLyricsUseCase?: {
      execute(input: {
        music_library_id: string;
        audio_object_key: string;
      }): Promise<void>;
    },
  ) {}

  async execute(input: ProcessAiCifraAnalysisJobInput): Promise<void> {
    const job = await this.jobRepo.findById(
      new AiCifraAnalysisJobId(input.job_id),
    );
    if (!job) {
      throw new NotFoundError(input.job_id, AiCifraAnalysisJob);
    }

    if (job.status !== "queued") {
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

    job.start();
    upload.markAnalyzing();

    await this.jobRepo.update(job);
    await this.uploadRepo.update(upload);

    try {
      // v12: Buscar metadados da music library para detecção de gênero
      let artist: string | null = null;
      let title: string | null = null;
      if (this.musicLibraryLookup && upload.music_library_id) {
        try {
          const lib = await this.musicLibraryLookup.findById(
            upload.music_library_id.id,
          );
          if (lib) {
            artist = lib.artist ?? null;
            title = lib.title ?? null;
          }
        } catch {
          // Fallback: sem metadados, v12 usa genre="all"
        }
      }

      const response = await this.client.analyze({
        job_id: job.ai_cifra_analysis_job_id.id,
        model_id: job.model_id,
        input_object_key: upload.object_key,
        artist,
        title,
      });

      const result = new AiCifraAnalysisResult({
        bpm: response.bpm ?? null,
        key: response.key ?? null,
        time_signature: response.time_signature ?? null,
        chords: response.chords ?? [],
        segments: response.segments ?? [],
        artifacts: response.artifacts ?? null,
      });

      job.complete(result);
      upload.markAnalyzed();

      await this.jobRepo.update(job);
      await this.uploadRepo.update(upload);

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
    } catch (error: any) {
      const { code, message } = this.mapError(error);
      if (this.isTransientError(code)) {
        job.requeue(code, message);
        upload.markAnalysisQueued();
        await this.jobRepo.update(job);
        await this.uploadRepo.update(upload);
        throw new AiCifraAnalysisRetryableError(code, message, error);
      } else {
        job.fail(code, message);
        upload.markAnalysisFailed(message);
        await this.jobRepo.update(job);
        await this.uploadRepo.update(upload);

        await this.storage
          .deleteObject({ object_key: upload.object_key })
          .catch(() => undefined);
      }
    }
  }

  // Worker devolve duration_seconds em artifacts tanto no /v1 quanto no
  // /v2/analyze -- ver Docs/ia-musical/folha-de-cifra.md "duration_mismatch"
  // (o fix de pontuação por duração no auto-sync de LRC ficava inerte sem
  // isto, porque MusicLibrary.duration_seconds nunca era escrito por
  // nenhum use-case do pipeline).
  private extractDurationSeconds(
    artifacts: Record<string, any> | null | undefined,
  ): number | null {
    const value = artifacts?.duration_seconds;
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : null;
  }

  private isTransientError(code: string): boolean {
    return code === "ANALYSIS_TIMEOUT" || code === "ANALYSIS_UNAVAILABLE";
  }

  private mapError(error: any): { code: string; message: string } {
    const response = error?.response;
    const responseData = response?.data;
    const httpStatus = response?.status;

    if (responseData?.code && responseData?.message) {
      return {
        code: `${responseData.code}`,
        message: `${responseData.message}`,
      };
    }

    if (responseData?.detail?.code && responseData?.detail?.message) {
      return {
        code: `${responseData.detail.code}`,
        message: `${responseData.detail.message}`,
      };
    }

    if (httpStatus === 404) {
      return {
        code: "ANALYSIS_SERVICE_NOT_FOUND",
        message: "Serviço de análise de cifras não encontrado",
      };
    }

    if (typeof httpStatus === "number" && httpStatus >= 500) {
      return {
        code: "ANALYSIS_UNAVAILABLE",
        message: "Serviço de análise de cifras indisponível",
      };
    }

    if (error?.code === "ECONNABORTED") {
      return {
        code: "ANALYSIS_TIMEOUT",
        message: "Timeout no serviço de análise de cifras",
      };
    }

    if (error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND") {
      return {
        code: "ANALYSIS_UNAVAILABLE",
        message: "Serviço de análise de cifras indisponível",
      };
    }

    const msg = error?.message ?? "Falha desconhecida ao analisar cifra";
    return { code: "ANALYSIS_FAILED", message: `${msg}` };
  }
}
