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
import { createReadStream, promises as fs } from "fs";
import { diskStorage } from "multer";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

import { MusicianOutput } from "../../core/musician/application/use-cases/common/musician-profile-output";
import { ClearMusicianTouringLocationUseCase } from "../../core/musician/application/use-cases/clear-musician-touring-location/clear-musician-touring-location.use-case";
import { SetMusicianTouringLocationUseCase } from "../../core/musician/application/use-cases/set-musician-touring-location/set-musician-touring-location.use-case";
import { CreateMusicianUseCase } from "../../core/musician/application/use-cases/create-musician/create-musician.use-case";
import { DeleteMusicianUseCase } from "../../core/musician/application/use-cases/delete-musician/delete-musician.use-case";
import { GetMusicianUseCase } from "../../core/musician/application/use-cases/get-musician/get-musician.use-case";
import { CustomizeQRCodeUseCase } from "../../core/musician/application/use-cases/customize-qr-code/customize-qr-code.use-case";
import { ListMusiciansUseCase } from "../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { RegisterPushTokenUseCase } from "../../core/musician/application/use-cases/register-push-token/register-push-token.use-case";
import { SetMusicianOpenToGigsUseCase } from "../../core/musician/application/use-cases/set-musician-open-to-gigs/set-musician-open-to-gigs.use-case";
import { UpdateMusicianUseCase } from "../../core/musician/application/use-cases/update-musician/update-musician.use-case";
import { UpdateMusicianProfileUseCase } from "../../core/musician/application/use-cases/update-musician-profile/update-musician-profile.use-case";
import { UploadMusicianAvatarUseCase } from "../../core/musician/application/use-cases/upload-musician-avatar/upload-musician-avatar.use-case";
import { UploadQrLogoUseCase } from "../../core/musician/application/use-cases/upload-qr-logo/upload-qr-logo.use-case";
import { VerifyMusicianUseCase } from "../../core/musician/application/use-cases/verify-musician/verify-musician.use-case";
import {
  AuthGuard,
  CurrentUserContextGuard,
  MusicianOwnershipGuard,
  Public,
  Roles,
  RolesGuard,
} from "../auth-module";
import { CreateMusicianDto } from "./dto/create-musician.dto";
import { CustomizeQRCodeDto } from "./dto/customize-qr-code.dto";
import { SearchMusiciansDto } from "./dto/search-musicians.dto";
import { RegisterPushTokenDto } from "./dto/register-push-token.dto";
import { SetMusicianOpenToGigsDto } from "./dto/set-musician-open-to-gigs.dto";
import { SetMusicianTouringLocationDto } from "./dto/set-musician-touring-location.dto";
import { UpdateMusicianDto } from "./dto/update-musician.dto";
import { UpdateMusicianProfileDto } from "./dto/update-musician-profile.dto";
import {
  MusicianCollectionPresenter,
  MusicianPresenter,
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

  @Inject(DeleteMusicianUseCase)
  private deleteUseCase: DeleteMusicianUseCase;

  @Inject(GetMusicianUseCase)
  private getUseCase: GetMusicianUseCase;

  @Inject(ListMusiciansUseCase)
  private listUseCase: ListMusiciansUseCase;

  @Inject(VerifyMusicianUseCase)
  private verifyUseCase: VerifyMusicianUseCase;

  @Inject(CustomizeQRCodeUseCase)
  private customizeQRCodeUseCase: CustomizeQRCodeUseCase;

  @Inject(UploadMusicianAvatarUseCase)
  private uploadAvatarUseCase: UploadMusicianAvatarUseCase;

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

  @Get(":id")
  @Public()
  @ApiOperation({
    summary: "Buscar músico por ID",
    description: "Retorna os detalhes do perfil do músico.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianPresenter })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getUseCase.execute({ id });
    return MusiciansController.serialize(output);
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
      limits: { fileSize: Number(process.env.MUSICIAN_AVATAR_MAX_SIZE ?? 5 * 1024 * 1024) },
      fileFilter: (_req, file, cb) => {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
          return cb(new Error("Only JPEG, PNG or WEBP images are allowed"), false);
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
      const { fileTypeFromBuffer } = await import("file-type");
      const fd = await fs.open(file.path, "r");
      const buf = Buffer.alloc(4100);
      await fd.read(buf, 0, 4100, 0);
      await fd.close();
      const detected = await fileTypeFromBuffer(buf);
      if (!detected || !["image/jpeg", "image/png", "image/webp"].includes(detected.mime)) {
        throw new UnprocessableEntityException(
          "Invalid file: only JPEG, PNG or WEBP images are accepted",
        );
      }

      const output = await this.uploadAvatarUseCase.execute({
        musician_id: id,
        data: createReadStream(file.path),
        content_type: detected.mime,
        file_size: file.size,
      });

      return MusiciansController.serialize(output);
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
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
      limits: { fileSize: Number(process.env.MUSICIAN_QR_LOGO_MAX_SIZE ?? 2 * 1024 * 1024) },
      fileFilter: (_req, file, cb) => {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
          return cb(new Error("Only JPEG, PNG or WEBP images are allowed"), false);
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
      const { fileTypeFromBuffer } = await import("file-type");
      const fd = await fs.open(file.path, "r");
      const buf = Buffer.alloc(4100);
      await fd.read(buf, 0, 4100, 0);
      await fd.close();
      const detected = await fileTypeFromBuffer(buf);
      if (!detected || !["image/jpeg", "image/png", "image/webp"].includes(detected.mime)) {
        throw new UnprocessableEntityException(
          "Invalid file: only JPEG, PNG or WEBP images are accepted",
        );
      }

      const output = await this.uploadQrLogoUseCase.execute({
        musician_id: id,
        data: createReadStream(file.path),
        content_type: detected.mime,
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
