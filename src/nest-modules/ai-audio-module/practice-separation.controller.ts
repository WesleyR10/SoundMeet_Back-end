import {
  Body,
  Controller,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { randomUUID } from "crypto";
import { createReadStream, promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { CreateAiAudioUploadUseCase } from "../../core/ai-audio/application/use-cases/create-ai-audio-upload/create-ai-audio-upload.use-case";
import { RequestAiAudioSeparationUseCase } from "../../core/ai-audio/application/use-cases/request-ai-audio-separation/request-ai-audio-separation.use-case";
import { ResolveAiCifraAudioCandidatesUseCase } from "../../core/ai-cifra/application/use-cases/resolve-ai-cifra-audio-candidates/resolve-ai-cifra-audio-candidates.use-case";
import { GetMusicLibraryUseCase } from "../../core/music-library/application/use-cases/get-music-library/get-music-library.use-case";
import { safeFetchToFile } from "../../core/shared/infra/http/safe-url-fetcher";
import {
  AuthGuard,
  CurrentUserContextGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { MusicianOwnershipGuard } from "../auth-module/ownership/musician-ownership.guard";
import { AiAudioSeparationJobPresenter } from "./ai-audio.presenter";
import { RequestPracticeSeparationDto } from "./dto/request-practice-separation.dto";

const MAX_FILE_SIZE_BYTES = Number(
  process.env.AI_AUDIO_MAX_FILE_SIZE ?? 70 * 1024 * 1024,
);

/**
 * Modo Ensaio (S3) — separar os stems de uma música da BIBLIOTECA do músico.
 *
 * ## Por que existe uma rota só para isto
 *
 * `AiAudioUploadsController` recebe arquivo multipart: serve para quem tem um
 * mp3 e quer separá-lo. Só que o app nunca envia arquivo — nem para a cifra: o
 * caminho real é `ai-cifra/uploads/from-provider/analyses`, onde o **backend**
 * resolve o áudio. Esta rota é a irmã daquela.
 *
 * ## O áudio da biblioteca não existe mais, e isso é de propósito
 *
 * `complete-ai-cifra-analysis-job` apaga o objeto no instante em que a análise
 * conclui — o sistema guarda a folha de cifra, nunca a gravação. Então não há o
 * que reaproveitar: a separação re-resolve a fonte pelo mesmo provider, usando
 * `source`/`source_id` que a própria análise gravou em `music_library`.
 *
 * ## E os stems têm prazo
 *
 * Stem **é** a gravação, separada — não um dado derivado como a cifra. Reter os
 * quatro indefinidamente seria uma postura de direito autoral diferente da que o
 * resto do projeto escolheu. `PurgeExpiredAiAudioStemsUseCase` varre o que
 * venceu; ver `core/ai-audio/domain/stems-retention.ts`.
 *
 * ## Ownership
 *
 * `:musician_id` no path com `MusicianOwnershipGuard` — o mesmo desenho de
 * `AiAudioUploadsController`, e o guard resolve o dono sem colisão porque não há
 * `:id` de sub-recurso nesta rota.
 */
@ApiTags("AI Audio")
@ApiBearerAuth("JWT-auth")
@UseGuards(
  AuthGuard,
  RolesGuard,
  CurrentUserContextGuard,
  MusicianOwnershipGuard,
)
@Roles("musician", "admin")
@Controller("musicians/:musician_id/ai-audio/practice")
export class PracticeSeparationController {
  @Inject(GetMusicLibraryUseCase)
  private getMusicLibraryUseCase: GetMusicLibraryUseCase;

  @Inject(ResolveAiCifraAudioCandidatesUseCase)
  private resolveCandidatesUseCase: ResolveAiCifraAudioCandidatesUseCase;

  @Inject(CreateAiAudioUploadUseCase)
  private createUploadUseCase: CreateAiAudioUploadUseCase;

  @Inject(RequestAiAudioSeparationUseCase)
  private requestSeparationUseCase: RequestAiAudioSeparationUseCase;

  @Post("separations")
  @ApiOperation({
    summary: "Modo Ensaio — separar os stems de uma música da biblioteca",
    description:
      "Re-resolve o áudio pelo provider (o original foi descartado após a análise da cifra), separa em stems e devolve o job. Os stems têm prazo de retenção: vencido, o job vira `expired` e basta pedir de novo.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: AiAudioSeparationJobPresenter })
  @ApiResponse({
    status: 422,
    description:
      "Música não é do músico, não tem fonte de áudio conhecida, ou nenhuma fonte respondeu.",
  })
  async requestFromLibrary(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @Body() dto: RequestPracticeSeparationDto,
  ) {
    const song = await this.getMusicLibraryUseCase.execute({
      id: dto.music_library_id,
    });

    // O guard prova quem é o usuário, nunca de quem é a música. Sem esta
    // comparação, qualquer músico separaria o item de biblioteca de outro
    // passando o id na URL própria — a mesma armadilha já registrada em
    // `personal-chord-sheet`.
    if (song.musician_id !== musician_id) {
      throw new UnprocessableEntityException(
        "Esta música não está na sua biblioteca.",
      );
    }

    // `source_id` é o que a análise da cifra gravou. Sem ele não há de onde
    // buscar o áudio de novo — e inventar uma busca por título+artista traria
    // outra gravação (ao vivo, cover, remaster), justamente o erro que
    // `spotify-track-matching.md` documenta como caro.
    if (song.source !== "youtube" || !song.source_id) {
      throw new UnprocessableEntityException(
        "Esta música não tem fonte de áudio conhecida. Só dá para ensaiar músicas analisadas pela IA de cifra.",
      );
    }

    const resolved = await this.resolveCandidatesUseCase.execute({
      youtube_video_id: song.source_id,
    });

    if (!resolved.candidates.length) {
      throw new UnprocessableEntityException(
        "Nenhuma fonte de áudio disponível para esta música agora.",
      );
    }

    let lastError = "Falha ao obter o áudio a partir das fontes";

    for (const candidate of resolved.candidates) {
      const tmpPath = join(
        tmpdir(),
        `${Date.now()}-${randomUUID()}-practice.audio`,
      );

      try {
        const downloaded = await safeFetchToFile({
          url: candidate.audio_url,
          destPath: tmpPath,
          maxBytes: MAX_FILE_SIZE_BYTES,
          contentTypeHint: candidate.content_type ?? null,
        });

        // O content_type sai dos magic bytes do que foi de fato baixado (SM-001),
        // nunca do que a fonte declarou.
        const upload = await this.createUploadUseCase.execute({
          musician_id,
          music_library_id: dto.music_library_id,
          original_filename:
            candidate.original_filename ?? `${song.title}.audio`,
          content_type: downloaded.content_type ?? "audio/mpeg",
          file_size: downloaded.file_size,
          upload_method: "from_source",
          data: createReadStream(tmpPath),
        });

        const job = await this.requestSeparationUseCase.execute({
          ai_audio_upload_id: upload.id,
          model_id: dto.model_id,
          output_format: dto.output_format,
          requesting_musician_id: musician_id,
        });

        return new AiAudioSeparationJobPresenter(job);
      } catch (error: unknown) {
        lastError =
          error instanceof Error ? error.message : "Fonte indisponível";
      } finally {
        await fs.unlink(tmpPath).catch(() => undefined);
      }
    }

    throw new UnprocessableEntityException(lastError);
  }
}
