import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
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
import { Throttle } from "@nestjs/throttler";
import { randomUUID } from "crypto";
import { createReadStream, promises as fs } from "fs";
import { diskStorage } from "multer";
import { tmpdir } from "os";

import { ClearMusicianTouringLocationUseCase } from "../../core/musician/application/use-cases/clear-musician-touring-location/clear-musician-touring-location.use-case";
import { MusicianOutput } from "../../core/musician/application/use-cases/common/musician-profile-output";
import { CreateMusicianUseCase } from "../../core/musician/application/use-cases/create-musician/create-musician.use-case";
import { CustomizeQRCodeUseCase } from "../../core/musician/application/use-cases/customize-qr-code/customize-qr-code.use-case";
import { DeleteMusicianUseCase } from "../../core/musician/application/use-cases/delete-musician/delete-musician.use-case";
import { DeleteMusicianPresentationAudioUseCase } from "../../core/musician/application/use-cases/delete-musician-presentation-audio/delete-musician-presentation-audio.use-case";
import { GetMusicianUseCase } from "../../core/musician/application/use-cases/get-musician/get-musician.use-case";
import { ListFeaturedMusiciansUseCase } from "../../core/musician/application/use-cases/list-featured-musicians/list-featured-musicians.use-case";
import { ListMusiciansUseCase } from "../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { RegisterPushTokenUseCase } from "../../core/musician/application/use-cases/register-push-token/register-push-token.use-case";
import { SetMusicianOpenToGigsUseCase } from "../../core/musician/application/use-cases/set-musician-open-to-gigs/set-musician-open-to-gigs.use-case";
import { SetMusicianRequestScopeUseCase } from "../../core/musician/application/use-cases/set-musician-request-scope/set-musician-request-scope.use-case";
import { SetMusicianTouringLocationUseCase } from "../../core/musician/application/use-cases/set-musician-touring-location/set-musician-touring-location.use-case";
import { UpdateMusicianUseCase } from "../../core/musician/application/use-cases/update-musician/update-musician.use-case";
import { UpdateMusicianProfileUseCase } from "../../core/musician/application/use-cases/update-musician-profile/update-musician-profile.use-case";
import { UploadMusicianAvatarUseCase } from "../../core/musician/application/use-cases/upload-musician-avatar/upload-musician-avatar.use-case";
import {
  PRESENTATION_AUDIO_ALLOWED_MIME_TYPES,
  UploadMusicianPresentationAudioUseCase,
} from "../../core/musician/application/use-cases/upload-musician-presentation-audio/upload-musician-presentation-audio.use-case";
import { UploadQrLogoUseCase } from "../../core/musician/application/use-cases/upload-qr-logo/upload-qr-logo.use-case";
import { VerifyMusicianUseCase } from "../../core/musician/application/use-cases/verify-musician/verify-musician.use-case";
import {
  AuthenticatedUser,
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
  MusicianOwnershipGuard,
  Public,
  Roles,
  RolesGuard,
} from "../auth-module";
import { assertFileSignature } from "../shared-module/upload/detect-file-mime";
import { readAudioDurationSeconds } from "../shared-module/upload/read-audio-duration";
import { CreateMusicianDto } from "./dto/create-musician.dto";
import { CustomizeQRCodeDto } from "./dto/customize-qr-code.dto";
import { RegisterPushTokenDto } from "./dto/register-push-token.dto";
import { SearchMusiciansDto } from "./dto/search-musicians.dto";
import { SetMusicianOpenToGigsDto } from "./dto/set-musician-open-to-gigs.dto";
import { SetMusicianRequestScopeDto } from "./dto/set-musician-request-scope.dto";
import { SetMusicianTouringLocationDto } from "./dto/set-musician-touring-location.dto";
import { UpdateMusicianDto } from "./dto/update-musician.dto";
import { UpdateMusicianProfileDto } from "./dto/update-musician-profile.dto";
import {
  MusicianCollectionPresenter,
  MusicianPresenter,
  PublicMusicianPresenter,
} from "./musician.presenter";

@ApiTags("Musicians")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("musicians")
export class MusiciansController {
  @Inject(CreateMusicianUseCase)
  private createUseCase: CreateMusicianUseCase;

  @Inject(UpdateMusicianUseCase)
  private updateUseCase: UpdateMusicianUseCase;

  @Inject(UpdateMusicianProfileUseCase)
  private updateProfileUseCase: UpdateMusicianProfileUseCase;

  @Inject(SetMusicianTouringLocationUseCase)
  private setTouringLocationUseCase: SetMusicianTouringLocationUseCase;

  @Inject(ClearMusicianTouringLocationUseCase)
  private clearTouringLocationUseCase: ClearMusicianTouringLocationUseCase;

  @Inject(RegisterPushTokenUseCase)
  private registerPushTokenUseCase: RegisterPushTokenUseCase;

  @Inject(SetMusicianOpenToGigsUseCase)
  private setOpenToGigsUseCase: SetMusicianOpenToGigsUseCase;

  @Inject(SetMusicianRequestScopeUseCase)
  private setRequestScopeUseCase: SetMusicianRequestScopeUseCase;

  @Inject(DeleteMusicianUseCase)
  private deleteUseCase: DeleteMusicianUseCase;

  @Inject(GetMusicianUseCase)
  private getUseCase: GetMusicianUseCase;

  @Inject(ListMusiciansUseCase)
  private listUseCase: ListMusiciansUseCase;

  @Inject(ListFeaturedMusiciansUseCase)
  private listFeaturedUseCase: ListFeaturedMusiciansUseCase;

  @Inject(VerifyMusicianUseCase)
  private verifyUseCase: VerifyMusicianUseCase;

  @Inject(CustomizeQRCodeUseCase)
  private customizeQRCodeUseCase: CustomizeQRCodeUseCase;

  @Inject(UploadMusicianAvatarUseCase)
  private uploadAvatarUseCase: UploadMusicianAvatarUseCase;

  @Inject(UploadMusicianPresentationAudioUseCase)
  private uploadPresentationAudioUseCase: UploadMusicianPresentationAudioUseCase;

  @Inject(DeleteMusicianPresentationAudioUseCase)
  private deletePresentationAudioUseCase: DeleteMusicianPresentationAudioUseCase;

  @Inject(UploadQrLogoUseCase)
  private uploadQrLogoUseCase: UploadQrLogoUseCase;

  @Post()
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Criar músico",
    description: "Cria um perfil de músico e gera QR Code permanente.",
  })
  @ApiResponse({ status: 201, type: MusicianPresenter })
  async create(@Body() createMusicianDto: CreateMusicianDto) {
    const output = await this.createUseCase.execute(createMusicianDto);
    return MusiciansController.serialize(output);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: "Listar músicos",
    description: "Lista músicos com paginação, ordenação e filtros.",
  })
  @ApiResponse({ status: 200, type: MusicianCollectionPresenter })
  async findAll(@Query() query: SearchMusiciansDto) {
    const output = await this.listUseCase.execute(query);
    return new MusicianCollectionPresenter(output);
  }

  /*
   * 🔴 ANTES de `@Get(":id")`, e isto NÃO é preferência de estilo.
   *
   * Depois dele, "featured" casaria como `:id`, o `ParseUUIDPipe` responderia
   * 422 e a faixa "Em destaque" deixaria de existir — sem erro de compilação,
   * sem teste vermelho, e com este handler correto logo abaixo. É o mesmo
   * defeito que `@Get("live")` teve em `PerformanceController` e que só
   * apareceu em tela.
   */
  @Get("featured")
  @Public()
  @ApiOperation({
    summary: "Artistas em destaque (assinantes)",
    description:
      "Os artistas da faixa 'Em destaque' da grade: assinantes de plano pago, ordenados por nota. 🔴 NÃO é ordenação da busca — é uma faixa separada e rotulada, para que 'Melhor avaliados' continue significando o que diz. O `plan_tier` não sai na resposta (dado comercial do artista), e o gate de consentimento não é contornado: quem não ligou 'disponível para shows' não aparece, pagando ou não.",
  })
  @ApiResponse({ status: 200, type: [PublicMusicianPresenter] })
  async findFeatured() {
    const output = await this.listFeaturedUseCase.execute({});
    /*
     * `PublicMusicianPresenter` mesmo sendo lido pelo estabelecimento
     * autenticado: a faixa é vitrine, e vitrine não precisa de e-mail nem
     * telefone do artista. A allowlist de campo é a do presenter público.
     */
    return output.items.map((item) => new PublicMusicianPresenter(item));
  }

  @Get(":id")
  @Public()
  @ApiOperation({
    summary: "Buscar músico por ID",
    description:
      "Retorna os detalhes do perfil do músico. Dono ou admin recebem email/telefone; qualquer outro chamador (autenticado ou anônimo) recebe a versão pública, sem PII.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianPresenter })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const output = await this.getUseCase.execute({ id });
    const isOwnerOrAdmin =
      currentUser?.isAdmin || currentUser?.userId === output.id;
    return isOwnerOrAdmin
      ? MusiciansController.serialize(output)
      : new PublicMusicianPresenter(output);
  }

  @Patch(":id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Atualizar músico",
    description: "Atualiza dados do perfil do músico.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianPresenter })
  async update(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() updateMusicianDto: UpdateMusicianDto,
  ) {
    const output = await this.updateUseCase.execute({
      ...updateMusicianDto,
      id,
    });
    return MusiciansController.serialize(output);
  }

  @Post(":id/avatar")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Upload de foto de perfil",
    description:
      "Faz upload da foto de perfil para o storage (Cloudflare R2/MinIO/S3). Limite: 5 MB. MIME obrigatório: image/jpeg, image/png ou image/webp.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, type: MusicianPresenter })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, tmpdir()),
        filename: (_req, file, cb) => {
          const safeName = (file.originalname || "avatar").replace(
            /[^a-zA-Z0-9._-]/g,
            "_",
          );
          cb(null, `${Date.now()}-${randomUUID()}-${safeName}`);
        },
      }),
      limits: {
        fileSize: Number(
          process.env.MUSICIAN_AVATAR_MAX_SIZE ?? 5 * 1024 * 1024,
        ),
      },
      fileFilter: (_req, file, cb) => {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
        ) {
          return cb(
            new Error("Only JPEG, PNG or WEBP images are allowed"),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadAvatar(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new UnprocessableEntityException("file is required");
    }

    try {
      const detectedMime = await assertFileSignature(
        file.path,
        ["image/jpeg", "image/png", "image/webp"],
        "Invalid file: only JPEG, PNG or WEBP images are accepted",
      );

      const output = await this.uploadAvatarUseCase.execute({
        musician_id: id,
        data: createReadStream(file.path),
        content_type: detectedMime,
        file_size: file.size,
      });

      return MusiciansController.serialize(output);
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  }

  @Post(":id/presentation-audio")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  /*
   * Limite próprio e apertado: um áudio custa banda de subida, espaço no bucket
   * e um parser de metadados por requisição. O `UserThrottlerGuard` global é
   * generoso demais para isso, e ninguém troca o áudio de apresentação cinco
   * vezes por minuto de boa-fé.
   */
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: "Upload do áudio de apresentação",
    description:
      "Trecho de 5 a 40 segundos que o estabelecimento ouve antes de contratar. " +
      "Formatos: MP3, M4A, AAC ou WAV (o tipo é deduzido dos BYTES, não do Content-Type enviado). " +
      "Substituir apaga o áudio anterior do storage.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, type: MusicianPresenter })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, tmpdir()),
        filename: (_req, file, cb) => {
          const safeName = (file.originalname || "presentation-audio").replace(
            /[^a-zA-Z0-9._-]/g,
            "_",
          );
          cb(null, `${Date.now()}-${randomUUID()}-${safeName}`);
        },
      }),
      limits: {
        fileSize: Number(
          process.env.MUSICIAN_PRESENTATION_AUDIO_MAX_SIZE ?? 10 * 1024 * 1024,
        ),
      },
      /*
       * Sem `fileFilter`, e é deliberado — mesmo desenho dos uploads de IA.
       * O `file.mimetype` é o que o CLIENTE escreveu, e os seletores de arquivo
       * de celular mandam `application/octet-stream` para um MP3 legítimo com
       * frequência. Filtrar pela afirmação recusaria arquivo bom e não impediria
       * arquivo ruim: quem decide é o `assertFileSignature` logo abaixo, que lê
       * os bytes.
       */
    }),
  )
  async uploadPresentationAudio(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new UnprocessableEntityException("Envie um arquivo de áudio.");
    }

    try {
      const detectedMime = await assertFileSignature(
        file.path,
        PRESENTATION_AUDIO_ALLOWED_MIME_TYPES,
        "Formato não suportado. Envie um arquivo MP3, M4A, AAC ou WAV.",
      );

      // Só depois dos magic bytes: o parser de metadados não deve ver arquivo
      // que sequer é áudio (ver read-audio-duration.ts).
      const durationSeconds = await readAudioDurationSeconds(file.path);

      const output = await this.uploadPresentationAudioUseCase.execute({
        musician_id: id,
        data: createReadStream(file.path),
        content_type: detectedMime,
        file_size: file.size,
        duration_seconds: durationSeconds,
      });

      return MusiciansController.serialize(output);
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  }

  @Delete(":id/presentation-audio")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Remove o áudio de apresentação",
    description:
      "Idempotente: quem não tem áudio recebe 200 com presentation_audio nulo. " +
      "Aceita admin para takedown de conteúdo.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianPresenter })
  async deletePresentationAudio(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.deletePresentationAudioUseCase.execute({
      musician_id: id,
    });

    return MusiciansController.serialize(output);
  }

  @Post(":id/qr-code/logo")
  @Roles("musician")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Upload de logo do QR Code (PRO)",
    description:
      "Faz upload do logo exibido no centro do QR Code personalizado. Requer plano PRO. Limite: 2 MB. MIME obrigatório: image/jpeg, image/png ou image/webp.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, type: MusicianPresenter })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, tmpdir()),
        filename: (_req, file, cb) => {
          const safeName = (file.originalname || "qr-logo").replace(
            /[^a-zA-Z0-9._-]/g,
            "_",
          );
          cb(null, `${Date.now()}-${randomUUID()}-${safeName}`);
        },
      }),
      limits: {
        fileSize: Number(
          process.env.MUSICIAN_QR_LOGO_MAX_SIZE ?? 2 * 1024 * 1024,
        ),
      },
      fileFilter: (_req, file, cb) => {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
        ) {
          return cb(
            new Error("Only JPEG, PNG or WEBP images are allowed"),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadQrLogo(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new UnprocessableEntityException("file is required");
    }

    try {
      const detectedMime = await assertFileSignature(
        file.path,
        ["image/jpeg", "image/png", "image/webp"],
        "Invalid file: only JPEG, PNG or WEBP images are accepted",
      );

      const output = await this.uploadQrLogoUseCase.execute({
        musician_id: id,
        data: createReadStream(file.path),
        content_type: detectedMime,
        file_size: file.size,
      });

      return MusiciansController.serialize(output);
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  }

  @Patch(":id/profile")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Atualizar perfil do músico",
    description:
      "Atualiza dados do MusicianProfile (preço, localização, links sociais).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianPresenter })
  async updateProfile(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: UpdateMusicianProfileDto,
  ) {
    const output = await this.updateProfileUseCase.execute({ ...dto, id });
    return MusiciansController.serialize(output);
  }

  @Patch(":id/touring-location")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Ativar modo turnê",
    description:
      "Define uma localização temporária (com expiração automática, máx. 30 dias) somada à base permanente para busca por proximidade.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianPresenter })
  async setTouringLocation(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: SetMusicianTouringLocationDto,
  ) {
    const output = await this.setTouringLocationUseCase.execute({ ...dto, id });
    return MusiciansController.serialize(output);
  }

  @Delete(":id/touring-location")
  @HttpCode(204)
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Encerrar modo turnê",
    description:
      "Remove a localização temporária antes do prazo (volta a valer só a base permanente).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async clearTouringLocation(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.clearTouringLocationUseCase.execute({ id });
  }

  @Patch(":id/open-to-gigs")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Definir disponibilidade para contratação",
    description:
      "Consentimento explícito do músico para aparecer na busca de estabelecimentos (radar de contratação para eventos/freelas). Nunca ligado por padrão — decisão do próprio músico.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianPresenter })
  async setOpenToGigs(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: SetMusicianOpenToGigsDto,
  ) {
    const output = await this.setOpenToGigsUseCase.execute({
      id,
      open_to_gigs: dto.open_to_gigs,
    });
    return MusiciansController.serialize(output);
  }

  @Patch(":id/request-scope")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Definir se o público pode pedir música fora do repertório",
    description:
      "Ligado (padrão), o fã busca no catálogo da plataforma e pode pedir qualquer música — o músico recusa o que não toca. Desligado, o pedido só é aceito acompanhado de uma música da biblioteca DESTE músico; a recusa passa a ser do servidor, não uma sugestão de UI.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianPresenter })
  async setRequestScope(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: SetMusicianRequestScopeDto,
  ) {
    const output = await this.setRequestScopeUseCase.execute({
      id,
      accepts_requests_outside_repertoire:
        dto.accepts_requests_outside_repertoire,
    });
    return MusiciansController.serialize(output);
  }

  @Patch(":id/push-token")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Registrar token de push notification",
    description:
      "Registra/atualiza o Expo push token do dispositivo do músico (último dispositivo registrado sobrescreve o anterior).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianPresenter })
  async registerPushToken(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: RegisterPushTokenDto,
  ) {
    const output = await this.registerPushTokenUseCase.execute({
      ...dto,
      id,
    });
    return MusiciansController.serialize(output);
  }

  @Post(":id/verify")
  @Roles("admin")
  @ApiOperation({
    summary: "Verificar músico",
    description: "Marca o músico como verificado (apenas admin).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianPresenter })
  async verify(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.verifyUseCase.execute({ id });
    return MusiciansController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Remover músico",
    description: "Remove o perfil do músico.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async remove(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.deleteUseCase.execute({ id });
  }

  @Post(":id/qr-code/customize")
  @Roles("musician")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Personalizar QR Code (PRO)",
    description:
      "Aplica personalização visual ao QR Code permanente do músico. Requer plano PRO.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianPresenter })
  async customizeQRCode(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: CustomizeQRCodeDto,
  ) {
    const output = await this.customizeQRCodeUseCase.execute({
      musician_id: id,
      customization: dto,
    });
    return MusiciansController.serialize(output);
  }

  static serialize(output: MusicianOutput) {
    return new MusicianPresenter(output);
  }
}
