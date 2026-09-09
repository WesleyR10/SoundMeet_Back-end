import {
  Controller,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { randomUUID } from "crypto";
import { createReadStream, promises as fs } from "fs";
import { diskStorage } from "multer";
import { tmpdir } from "os";
import { join } from "path";

import { CreateAiAudioUploadUseCase } from "../../core/ai-audio/application/use-cases/create-ai-audio-upload/create-ai-audio-upload.use-case";
import {
  AuthGuard,
  CurrentUserContextGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { MusicianOwnershipGuard } from "../auth-module/ownership/musician-ownership.guard";
import { detectFileMime } from "../shared-module/upload/detect-file-mime";
import { AiAudioUploadPresenter } from "./ai-audio.presenter";

const MAX_FILE_SIZE_BYTES = Number(
  process.env.AI_AUDIO_MAX_FILE_SIZE ?? 70 * 1024 * 1024,
);

@ApiTags("AI Audio")
@ApiBearerAuth("JWT-auth")
@UseGuards(
  AuthGuard,
  RolesGuard,
  CurrentUserContextGuard,
  MusicianOwnershipGuard,
)
@Roles("musician", "admin")
@Controller("musicians/:musician_id/ai-audio/uploads")
export class AiAudioUploadsController {
  @Inject(CreateAiAudioUploadUseCase)
  private createUploadUseCase: CreateAiAudioUploadUseCase;

  @Post()
  @ApiOperation({
    summary: "Upload de áudio (IA)",
    description:
      "Faz upload do áudio para o storage (Cloudflare R2/MinIO/S3) e cria o registro.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, type: AiAudioUploadPresenter })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, tmpdir()),
        filename: (_req, file, cb) => {
          const safeName = (file.originalname || "file").replace(
            /[^a-zA-Z0-9._-]/g,
            "_",
          );
          cb(null, `${Date.now()}-${randomUUID()}-${safeName}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async upload(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const tmpPath = file?.path
      ? file.path
      : join(tmpdir(), `${Date.now()}-${randomUUID()}`);
    try {
      /*
       * 🔴 UPL-1: `content_type` vem dos BYTES, nunca de `file.mimetype`.
       * O mimetype do multer é o `Content-Type` que o cliente escreveu — um
       * `.exe` anunciado como `audio/mpeg` passava direto para o bucket e para
       * o worker de GPU. O `CreateAiAudioUploadUseCase` já aplicava a allowlist
       * de `AI_AUDIO_ALLOWED_MIME_TYPES`; ela só estava incidindo sobre a
       * afirmação do cliente em vez do conteúdo real.
       *
       * `null` (formato não identificado) chega ao use-case como string vazia e
       * é recusado lá — a allowlist é fail-closed.
       */
      const detectedMime = await detectFileMime(tmpPath);

      const output = await this.createUploadUseCase.execute({
        musician_id,
        original_filename: file.originalname,
        content_type: detectedMime ?? "",
        file_size: file.size,
        data: createReadStream(tmpPath),
      });
      return new AiAudioUploadPresenter(output);
    } finally {
      if (file?.path) {
        await fs.unlink(file.path).catch(() => undefined);
      }
    }
  }
}
