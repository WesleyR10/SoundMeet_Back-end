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
import { randomUUID } from "crypto";
import { createReadStream, promises as fs } from "fs";
import { diskStorage } from "multer";
import { tmpdir } from "os";

import {
  EstablishmentOutput,
  EstablishmentProfileOutput,
} from "../../core/establishment/application/use-cases/common/establishment-output";
import { CreateEstablishmentUseCase } from "../../core/establishment/application/use-cases/create-establishment/create-establishment.use-case";
import { CreateEstablishmentProfileUseCase } from "../../core/establishment/application/use-cases/create-establishment-profile/create-establishment-profile.use-case";
import { DeleteEstablishmentUseCase } from "../../core/establishment/application/use-cases/delete-establishment/delete-establishment.use-case";
import { DeleteEstablishmentAvatarUseCase } from "../../core/establishment/application/use-cases/delete-establishment-avatar/delete-establishment-avatar.use-case";
import { DeleteEstablishmentCoverUseCase } from "../../core/establishment/application/use-cases/delete-establishment-cover/delete-establishment-cover.use-case";
import { DeleteEstablishmentMenuPdfUseCase } from "../../core/establishment/application/use-cases/delete-establishment-menu-pdf/delete-establishment-menu-pdf.use-case";
import { DeleteEstablishmentProfileUseCase } from "../../core/establishment/application/use-cases/delete-establishment-profile/delete-establishment-profile.use-case";
import { GetEstablishmentUseCase } from "../../core/establishment/application/use-cases/get-establishment/get-establishment.use-case";
import { GetHiringDashboardUseCase } from "../../core/establishment/application/use-cases/get-hiring-dashboard/get-hiring-dashboard.use-case";
import { ListEstablishmentAnalyticsUseCase } from "../../core/establishment/application/use-cases/list-establishment-analytics/list-establishment-analytics.use-case";
import { ListEstablishmentsUseCase } from "../../core/establishment/application/use-cases/list-establishments/list-establishments.use-case";
import { UpdateEstablishmentUseCase } from "../../core/establishment/application/use-cases/update-establishment/update-establishment.use-case";
import { UpdateEstablishmentProfileUseCase } from "../../core/establishment/application/use-cases/update-establishment-profile/update-establishment-profile.use-case";
import { UploadEstablishmentAvatarUseCase } from "../../core/establishment/application/use-cases/upload-establishment-avatar/upload-establishment-avatar.use-case";
import { UploadEstablishmentCoverUseCase } from "../../core/establishment/application/use-cases/upload-establishment-cover/upload-establishment-cover.use-case";
import { UploadEstablishmentMenuPdfUseCase } from "../../core/establishment/application/use-cases/upload-establishment-menu-pdf/upload-establishment-menu-pdf.use-case";
import { VerifyEstablishmentUseCase } from "../../core/establishment/application/use-cases/verify-establishment/verify-establishment.use-case";
import {
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
  EstablishmentOwnershipGuard,
  Public,
  Roles,
  RolesGuard,
} from "../auth-module";
import { AuthenticatedUser } from "../auth-module";
import { assertFileSignature } from "../shared-module/upload/detect-file-mime";
import { CreateEstablishmentDto } from "./dto/create-establishment.dto";
import { CreateEstablishmentProfileDto } from "./dto/create-establishment-profile.dto";
import { GetHiringDashboardDto } from "./dto/get-hiring-dashboard.dto";
import { SearchEstablishmentAnalyticsDto } from "./dto/search-establishment-analytics.dto";
import { SearchEstablishmentsDto } from "./dto/search-establishments.dto";
import { UpdateEstablishmentDto } from "./dto/update-establishment.dto";
import { UpdateEstablishmentProfileDto } from "./dto/update-establishment-profile.dto";
import {
  EstablishmentCollectionPresenter,
  EstablishmentPresenter,
  EstablishmentProfilePresenter,
} from "./establishment.presenter";
import { EstablishmentAnalyticsCollectionPresenter } from "./establishment-analytics.presenter";
import { HiringDashboardPresenter } from "./hiring-dashboard.presenter";

@ApiTags("Establishments")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("establishments")
export class EstablishmentsController {
  @Inject(CreateEstablishmentUseCase)
  private createUseCase: CreateEstablishmentUseCase;

  @Inject(UpdateEstablishmentUseCase)
  private updateUseCase: UpdateEstablishmentUseCase;

  @Inject(DeleteEstablishmentUseCase)
  private deleteUseCase: DeleteEstablishmentUseCase;

  @Inject(GetEstablishmentUseCase)
  private getUseCase: GetEstablishmentUseCase;

  @Inject(ListEstablishmentsUseCase)
  private listUseCase: ListEstablishmentsUseCase;

  @Inject(CreateEstablishmentProfileUseCase)
  private createProfileUseCase: CreateEstablishmentProfileUseCase;

  @Inject(UpdateEstablishmentProfileUseCase)
  private updateProfileUseCase: UpdateEstablishmentProfileUseCase;

  @Inject(DeleteEstablishmentProfileUseCase)
  private deleteProfileUseCase: DeleteEstablishmentProfileUseCase;

  @Inject(GetHiringDashboardUseCase)
  private getHiringDashboardUseCase: GetHiringDashboardUseCase;

  @Inject(ListEstablishmentAnalyticsUseCase)
  private listAnalyticsUseCase: ListEstablishmentAnalyticsUseCase;

  @Inject(VerifyEstablishmentUseCase)
  private verifyUseCase: VerifyEstablishmentUseCase;

  @Inject(UploadEstablishmentAvatarUseCase)
  private uploadAvatarUseCase: UploadEstablishmentAvatarUseCase;

  @Inject(DeleteEstablishmentAvatarUseCase)
  private deleteAvatarUseCase: DeleteEstablishmentAvatarUseCase;

  @Inject(UploadEstablishmentCoverUseCase)
  private uploadCoverUseCase: UploadEstablishmentCoverUseCase;

  @Inject(DeleteEstablishmentCoverUseCase)
  private deleteCoverUseCase: DeleteEstablishmentCoverUseCase;

  @Inject(UploadEstablishmentMenuPdfUseCase)
  private uploadMenuPdfUseCase: UploadEstablishmentMenuPdfUseCase;

  @Inject(DeleteEstablishmentMenuPdfUseCase)
  private deleteMenuPdfUseCase: DeleteEstablishmentMenuPdfUseCase;

  @Post()
  @Roles("establishment", "admin")
  @ApiOperation({
    summary: "Criar estabelecimento",
    description: "Cria um estabelecimento e gera QR Code permanente.",
  })
  @ApiResponse({ status: 201, type: EstablishmentPresenter })
  async create(
    @Body() dto: CreateEstablishmentDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const output = await this.createUseCase.execute({
      ...dto,
      existing_establishment_ids: currentUser?.establishmentIds ?? [],
      owner_user_id: currentUser?.userId,
    });
    return EstablishmentsController.serialize(output);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: "Listar estabelecimentos",
    description: "Lista estabelecimentos com paginação, ordenação e filtros.",
  })
  @ApiResponse({ status: 200, type: EstablishmentCollectionPresenter })
  async findAll(@Query() query: SearchEstablishmentsDto) {
    const output = await this.listUseCase.execute(query);
    return new EstablishmentCollectionPresenter(output);
  }

  @Get(":id")
  @Public()
  @ApiOperation({
    summary: "Buscar estabelecimento por ID",
    description: "Retorna os detalhes do estabelecimento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EstablishmentPresenter })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getUseCase.execute({ id });
    return EstablishmentsController.serialize(output);
  }

  @Patch(":id")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Atualizar estabelecimento",
    description: "Atualiza dados do estabelecimento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EstablishmentPresenter })
  async update(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: UpdateEstablishmentDto,
  ) {
    const output = await this.updateUseCase.execute({ ...dto, id });
    return EstablishmentsController.serialize(output);
  }

  @Post(":id/profile")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Criar perfil do estabelecimento",
    description:
      "Cria dados do EstablishmentProfile (capacidade, localização, preço, links sociais).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: EstablishmentProfilePresenter })
  async createProfile(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: CreateEstablishmentProfileDto,
  ) {
    const output = await this.createProfileUseCase.execute({ ...dto, id });
    return EstablishmentsController.serializeProfile(output);
  }

  @Patch(":id/profile")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Atualizar perfil do estabelecimento",
    description:
      "Atualiza dados do EstablishmentProfile (capacidade, localização, preço, links sociais).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EstablishmentProfilePresenter })
  async updateProfile(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: UpdateEstablishmentProfileDto,
  ) {
    const output = await this.updateProfileUseCase.execute({ ...dto, id });
    return EstablishmentsController.serializeProfile(output);
  }

  @HttpCode(204)
  @Delete(":id/profile")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Remover perfil do estabelecimento",
    description: "Remove o EstablishmentProfile.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async removeProfile(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.deleteProfileUseCase.execute({ id });
  }

  @Post(":id/verify")
  @Roles("admin")
  @ApiOperation({
    summary: "Verificar estabelecimento",
    description: "Marca o estabelecimento como verificado (apenas admin).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EstablishmentPresenter })
  async verify(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.verifyUseCase.execute({ id });
    return EstablishmentsController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Remover estabelecimento",
    description: "Remove o estabelecimento.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async remove(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.deleteUseCase.execute({ id });
  }

  @Get(":id/hiring-dashboard")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Dashboard de Contratação",
    description:
      "Retorna dados agregados para contratação de músicos e bandas.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: HiringDashboardPresenter })
  async getHiringDashboard(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query() query: GetHiringDashboardDto,
  ) {
    const output = await this.getHiringDashboardUseCase.execute({
      establishment_id: id,
      musicians_page: query.musicians_page,
      musicians_per_page: query.musicians_per_page,
      musicians_sort: query.musicians_sort,
      musicians_sort_dir: query.musicians_sort_dir,
      bands_page: query.bands_page,
      bands_per_page: query.bands_per_page,
      bands_sort: query.bands_sort,
      bands_sort_dir: query.bands_sort_dir,
      events_page: query.events_page,
      events_per_page: query.events_per_page,
      events_sort: query.events_sort,
      events_sort_dir: query.events_sort_dir,
      filters: query.filters,
    });
    return new HiringDashboardPresenter(output);
  }

  @Get(":id/analytics")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Consultar analytics do estabelecimento",
    description:
      "Lista métricas diárias do estabelecimento em um período (pré-agregadas).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EstablishmentAnalyticsCollectionPresenter })
  @ApiResponse({
    status: 402,
    description:
      "Plano FREE — `advanced_analytics` exige Growth ou PRO (gate 9.7a).",
  })
  async listAnalytics(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query() query: SearchEstablishmentAnalyticsDto,
  ) {
    const output = await this.listAnalyticsUseCase.execute({
      establishment_id: id,
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
      filter: {
        ...(query.date_gte && { date_gte: query.date_gte }),
        ...(query.date_lte && { date_lte: query.date_lte }),
      },
    });

    return new EstablishmentAnalyticsCollectionPresenter(output);
  }

  @Post(":id/avatar")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Upload da foto de perfil do espaço",
    description:
      "Envia a foto de perfil (logo) do estabelecimento. Limite: 2 MB. Formatos: JPEG, PNG ou WEBP — validados pelos BYTES do arquivo, não pelo Content-Type declarado. Substituir a foto apaga a anterior do storage.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, type: EstablishmentPresenter })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, tmpdir()),
        filename: (_req, file, cb) => {
          // Nome original saneado — mesma defesa de path traversal da capa.
          const safeName = (file.originalname || "avatar.jpg").replace(
            /[^a-zA-Z0-9._-]/g,
            "_",
          );
          cb(null, `${Date.now()}-${randomUUID()}-${safeName}`);
        },
      }),
      limits: {
        fileSize: Number(
          process.env.ESTABLISHMENT_AVATAR_MAX_SIZE ?? 2 * 1024 * 1024,
        ),
      },
      fileFilter: (_req, file, cb) => {
        // Peneira fraca (header do cliente). Quem decide é o
        // `assertFileSignature` abaixo, lendo os bytes (UPL-1).
        if (!file.mimetype.startsWith("image/")) {
          return cb(new Error("Only image files are allowed"), false);
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
      /*
       * 🔴 O tipo gravado é o DETECTADO, não o declarado — mesma razão da capa:
       * um HTML anunciado como `image/png` servido pelo CDN seria XSS
       * armazenado no nosso domínio de mídia.
       */
      const detectedMime = await assertFileSignature(
        file.path,
        ["image/jpeg", "image/png", "image/webp"],
        "Invalid file: only JPEG, PNG or WEBP images are accepted",
      );

      const output = await this.uploadAvatarUseCase.execute({
        establishment_id: id,
        data: createReadStream(file.path),
        content_type: detectedMime,
        file_size: file.size,
      });

      return EstablishmentsController.serialize(output);
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  }

  @Delete(":id/avatar")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Remover a foto de perfil do espaço",
    description:
      "Apaga a foto enviada e volta para o ícone padrão. Idempotente: quem não tem foto recebe 200 com `avatar: null`.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EstablishmentPresenter })
  async deleteAvatar(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.deleteAvatarUseCase.execute({
      establishment_id: id,
    });

    return EstablishmentsController.serialize(output);
  }

  @Post(":id/cover")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Upload da capa do espaço",
    description:
      "Envia a imagem de capa (banner) do estabelecimento. Limite: 4 MB. Formatos: JPEG, PNG ou WEBP — validados pelos BYTES do arquivo, não pelo Content-Type declarado. Substituir a capa apaga a anterior do storage.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, type: EstablishmentPresenter })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, tmpdir()),
        filename: (_req, file, cb) => {
          /*
           * ⚠️ O nome original NUNCA vai cru para o disco. `originalname` é
           * escrito pelo cliente e um `../../etc/cron.d/x` ali escaparia do
           * diretório temporário. O `replace` deixa só `[a-zA-Z0-9._-]`, e o
           * prefixo com timestamp + UUID garante unicidade mesmo quando dois
           * uploads chegam com o mesmo nome saneado.
           */
          const safeName = (file.originalname || "cover.jpg").replace(
            /[^a-zA-Z0-9._-]/g,
            "_",
          );
          cb(null, `${Date.now()}-${randomUUID()}-${safeName}`);
        },
      }),
      limits: {
        fileSize: Number(
          process.env.ESTABLISHMENT_COVER_MAX_SIZE ?? 4 * 1024 * 1024,
        ),
      },
      fileFilter: (_req, file, cb) => {
        /*
         * Primeira peneira, e a mais fraca das duas: `file.mimetype` é o
         * header que o cliente escreveu. Ela existe para não gastar disco com
         * um `.zip` óbvio; quem decide de verdade é o `assertFileSignature`
         * abaixo, que lê os bytes (UPL-1).
         */
        if (!file.mimetype.startsWith("image/")) {
          return cb(new Error("Only image files are allowed"), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadCover(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new UnprocessableEntityException("file is required");
    }

    try {
      /*
       * 🔴 O tipo que vai para o storage é o DETECTADO, não o declarado. Sem
       * isto, um HTML anunciado como `image/png` seria servido pelo CDN com o
       * Content-Type que o atacante escolheu — e um `text/html` hospedado no
       * nosso domínio de mídia é XSS armazenado de graça.
       */
      const detectedMime = await assertFileSignature(
        file.path,
        ["image/jpeg", "image/png", "image/webp"],
        "Invalid file: only JPEG, PNG or WEBP images are accepted",
      );

      const output = await this.uploadCoverUseCase.execute({
        establishment_id: id,
        data: createReadStream(file.path),
        content_type: detectedMime,
        file_size: file.size,
      });

      return EstablishmentsController.serialize(output);
    } finally {
      // O temporário sai em qualquer desfecho — inclusive quando a assinatura
      // reprova, que é justamente o caso em que deixar o arquivo no disco
      // seria pior.
      await fs.unlink(file.path).catch(() => undefined);
    }
  }

  @Delete(":id/cover")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Remover a capa do espaço",
    description:
      "Apaga a capa enviada e volta para a capa gerada pela marca. Idempotente: quem não tem capa recebe 200 com `cover: null`.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: EstablishmentPresenter })
  async deleteCover(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.deleteCoverUseCase.execute({
      establishment_id: id,
    });

    return EstablishmentsController.serialize(output);
  }

  @Post(":id/menu-pdf")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Upload do cardápio PDF",
    description:
      "Faz upload do cardápio em PDF para o storage (Cloudflare R2/MinIO/S3). Limite: 5 MB. MIME obrigatório: application/pdf.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, type: EstablishmentProfilePresenter })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, tmpdir()),
        filename: (_req, file, cb) => {
          const safeName = (file.originalname || "menu.pdf").replace(
            /[^a-zA-Z0-9._-]/g,
            "_",
          );
          cb(null, `${Date.now()}-${randomUUID()}-${safeName}`);
        },
      }),
      limits: {
        fileSize: Number(
          process.env.ESTABLISHMENT_MENU_PDF_MAX_SIZE ?? 5 * 1024 * 1024,
        ),
      },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== "application/pdf") {
          return cb(new Error("Only PDF files are allowed"), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadMenuPdf(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new UnprocessableEntityException("file is required");
    }

    try {
      await assertFileSignature(
        file.path,
        ["application/pdf"],
        "Invalid file: only PDF format is accepted",
      );

      const output = await this.uploadMenuPdfUseCase.execute({
        establishment_id: id,
        data: createReadStream(file.path),
        content_type: "application/pdf",
        file_size: file.size,
      });

      return EstablishmentsController.serializeProfile(output);
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  }

  @HttpCode(204)
  @Delete(":id/menu-pdf/:pdf_id")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({
    summary: "Remover cardápio PDF",
    description:
      "Remove um PDF do cardápio pelo seu ID. O estabelecimento pode ter até 2 cardápios simultâneos; use o pdf_id retornado no campo menu_pdfs do perfil.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "pdf_id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async removeMenuPdf(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Param("pdf_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    pdfId: string,
  ) {
    await this.deleteMenuPdfUseCase.execute({
      establishment_id: id,
      pdf_id: pdfId,
    });
  }

  static serialize(output: EstablishmentOutput) {
    return new EstablishmentPresenter(output);
  }

  static serializeProfile(output: EstablishmentProfileOutput) {
    return new EstablishmentProfilePresenter(output);
  }
}
