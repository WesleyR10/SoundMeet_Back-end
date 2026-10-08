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
  UnauthorizedException,
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
import { createReadStream, promises as fs } from "fs";

import { ClearMusicianTouringLocationUseCase } from "../../core/musician/application/use-cases/clear-musician-touring-location/clear-musician-touring-location.use-case";
import { ClearPushTokenUseCase } from "../../core/musician/application/use-cases/clear-push-token/clear-push-token.use-case";
import { MusicianOutput } from "../../core/musician/application/use-cases/common/musician-profile-output";
import { CustomizeQRCodeUseCase } from "../../core/musician/application/use-cases/customize-qr-code/customize-qr-code.use-case";
import { DeleteMusicianPresentationAudioUseCase } from "../../core/musician/application/use-cases/delete-musician-presentation-audio/delete-musician-presentation-audio.use-case";
import { GetMusicianUseCase } from "../../core/musician/application/use-cases/get-musician/get-musician.use-case";
import { ListFeaturedMusiciansUseCase } from "../../core/musician/application/use-cases/list-featured-musicians/list-featured-musicians.use-case";
import { ListMusicianIdentitiesUseCase } from "../../core/musician/application/use-cases/list-musician-identities/list-musician-identities.use-case";
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
  RejectedTokenSub,
  Roles,
  RolesGuard,
} from "../auth-module";
import { assertFileSignature } from "../shared-module/upload/detect-file-mime";
import { readAudioDurationSeconds } from "../shared-module/upload/read-audio-duration";
import { tempDiskUpload } from "../shared-module/upload/temp-disk-upload";
import { CustomizeQRCodeDto } from "./dto/customize-qr-code.dto";
import { ListMusicianIdentitiesDto } from "./dto/list-musician-identities.dto";
import { RegisterPushTokenDto } from "./dto/register-push-token.dto";
import { SearchMusiciansDto } from "./dto/search-musicians.dto";
import { SetMusicianOpenToGigsDto } from "./dto/set-musician-open-to-gigs.dto";
import { SetMusicianRequestScopeDto } from "./dto/set-musician-request-scope.dto";
import { SetMusicianTouringLocationDto } from "./dto/set-musician-touring-location.dto";
import { UpdateMusicianDto } from "./dto/update-musician.dto";
import { UpdateMusicianProfileDto } from "./dto/update-musician-profile.dto";
import {
  MusicianCardPresenter,
  MusicianCollectionPresenter,
  MusicianIdentityPresenter,
  MusicianPresenter,
  PublicMusicianPresenter,
} from "./musician.presenter";

@ApiTags("Musicians")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("musicians")
export class MusiciansController {
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

  @Inject(ClearPushTokenUseCase)
  private clearPushTokenUseCase: ClearPushTokenUseCase;

  @Inject(SetMusicianOpenToGigsUseCase)
  private setOpenToGigsUseCase: SetMusicianOpenToGigsUseCase;

  @Inject(SetMusicianRequestScopeUseCase)
  private setRequestScopeUseCase: SetMusicianRequestScopeUseCase;

  @Inject(GetMusicianUseCase)
  private getUseCase: GetMusicianUseCase;

  @Inject(ListMusiciansUseCase)
  private listUseCase: ListMusiciansUseCase;

  @Inject(ListFeaturedMusiciansUseCase)
  private listFeaturedUseCase: ListFeaturedMusiciansUseCase;

  @Inject(ListMusicianIdentitiesUseCase)
  private listIdentitiesUseCase: ListMusicianIdentitiesUseCase;

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

  /*
   * 🔴 NÃO existe `POST /musicians`, e a ausência é a correção (out/2026).
   *
   * O único caminho de nascimento de um `Musician` é o registro
   * (`RegisterUseCase` e o cadastro social), que faz
   * `new MusicianId(externalId)` — o `sub` do Keycloak. A rota que existia
   * aqui criava o agregado com UUID ALEATÓRIO e bastava ter o papel
   * `musician` para chamá-la: perfil que ninguém consegue logar, mas que
   * aparecia na grade das casas (`open_to_gigs` vinha do corpo) e, por ocupar
   * o e-mail, bloqueava o cadastro do dono verdadeiro daquele endereço.
   *
   * É o mesmo defeito do `POST /audiences` removido no SM-021, e a mesma
   * conclusão: restringir a `admin` não resolveria — uma capacidade que só
   * sabe produzir agregado violando a invariante de identidade não fica
   * melhor com autorização. Há regressão em `musicians.controller.spec.ts`
   * que falha se um `@Post()` nascer na raiz deste controller.
   */

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
  @ApiResponse({ status: 200, type: [MusicianCardPresenter] })
  async findFeatured() {
    const output = await this.listFeaturedUseCase.execute({});
    /*
     * O mesmo cartão da busca, mesmo sendo lido pelo estabelecimento
     * autenticado: a faixa é vitrine, e vitrine não precisa de e-mail nem
     * telefone do artista. A allowlist de campo é a do cartão de lista.
     */
    return output.items.map((item) => new MusicianCardPresenter(item));
  }

  /*
   * 🔴 Também ANTES de `@Get(":id")` — mesma razão de `featured` acima.
   */
  @Get("identities")
  @Public()
  @ApiOperation({
    summary: "Identidade de vários músicos",
    description:
      "Nome exibido, foto, instrumentos e gêneros de até 50 músicos numa chamada (`?ids=a,b,c`). Existe para as listas que guardam só o id (line-up, contratações, conversas) não fazerem um `GET /musicians/:id` por artista. Não é descoberta: só resolve ids que o chamador já tem, e por isso não passa pelo gate de `open_to_gigs` — como o `GET /musicians/:id`. Id inexistente não volta.",
  })
  @ApiResponse({ status: 200, type: [MusicianIdentityPresenter] })
  async findIdentities(@Query() query: ListMusicianIdentitiesDto) {
    const output = await this.listIdentitiesUseCase.execute({ ids: query.ids });
    return output.items.map((item) => new MusicianIdentityPresenter(item));
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
  @ApiResponse({
    status: 401,
    description:
      "O token enviado é do próprio músico, mas foi recusado (expirado). O cliente renova a sessão e repete.",
  })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
    @RejectedTokenSub() rejectedTokenSub?: string,
  ) {
    /*
     * 🔴 O dono com token expirado recebe 401, não a versão pública.
     *
     * Esta rota é `@Public()` com autenticação opcional: token recusado vira
     * anônimo. Para um terceiro isso é inofensivo — ele recebe a mesma versão
     * pública de qualquer jeito. Para o DONO era um defeito intermitente por
     * desenho: o access token dura 15 minutos, o app só renova a sessão ao
     * receber 401, e daqui saía 200 com o perfil SEM e-mail, telefone, CNPJ e
     * endereço. A tela de edição abria com o CNPJ vazio, e salvar gravava
     * `cnpj: null`.
     *
     * O `sub` aqui NÃO foi verificado e por isso só serve para recusar mais:
     * forjar o id de outro músico rende um 401, nunca um dado.
     */
    if (!currentUser && rejectedTokenSub === id) {
      throw new UnauthorizedException();
    }

    const isOwnerOrAdmin = Boolean(
      currentUser?.isAdmin || currentUser?.userId === id,
    );
    const output = await this.getUseCase.execute({
      id,
      include_plan_tier: isOwnerOrAdmin,
    });
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
  // Mesmo teto do áudio de apresentação: cada envio grava um objeto novo no
  // bucket, e o limite global (100/min) deixava uma conta subir 500 MB por
  // minuto em fotos que ninguém vai ver.
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: "Upload de foto de perfil",
    description:
      "Faz upload da foto de perfil para o storage (Cloudflare R2/MinIO/S3). Limite: 5 MB. MIME obrigatório: image/jpeg, image/png ou image/webp.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, type: MusicianPresenter })
  @UseInterceptors(
    FileInterceptor(
      "file",
      /*
       * Sem `fileFilter` (ver `tempDiskUpload`): o que havia aqui lançava
       * `new Error(...)` quando o `Content-Type` DECLARADO não era imagem, e a
       * resposta era 500 + Sentry para um arquivo errado. Quem decide o
       * formato é o `assertFileSignature` abaixo, que lê os bytes e responde
       * 422.
       */
      tempDiskUpload({
        fallbackName: "avatar",
        maxFileSize: Number(
          process.env.MUSICIAN_AVATAR_MAX_SIZE ?? 5 * 1024 * 1024,
        ),
      }),
    ),
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
        "Formato não suportado. Envie uma imagem JPEG, PNG ou WEBP.",
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
    FileInterceptor(
      "file",
      tempDiskUpload({
        fallbackName: "presentation-audio",
        maxFileSize: Number(
          process.env.MUSICIAN_PRESENTATION_AUDIO_MAX_SIZE ?? 10 * 1024 * 1024,
        ),
      }),
    ),
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
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: "Upload de logo do QR Code (PRO)",
    description:
      "Faz upload do logo exibido no centro do QR Code personalizado. Requer plano PRO. Limite: 2 MB. MIME obrigatório: image/jpeg, image/png ou image/webp.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, type: MusicianPresenter })
  @UseInterceptors(
    FileInterceptor(
      "file",
      tempDiskUpload({
        fallbackName: "qr-logo",
        maxFileSize: Number(
          process.env.MUSICIAN_QR_LOGO_MAX_SIZE ?? 2 * 1024 * 1024,
        ),
      }),
    ),
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
        "Formato não suportado. Envie uma imagem JPEG, PNG ou WEBP.",
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
  @HttpCode(204)
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Registrar token de push notification",
    description:
      "Registra/atualiza o Expo push token do dispositivo do músico (último dispositivo registrado sobrescreve o anterior). Sem corpo na resposta: o app chama a cada abertura e nunca leu o perfil que vinha de volta.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async registerPushToken(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: RegisterPushTokenDto,
  ) {
    await this.registerPushTokenUseCase.execute({
      ...dto,
      id,
    });
  }

  @Delete(":id/push-token")
  @HttpCode(204)
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Apagar token de push notification",
    description:
      "Chamado pelo app ao sair da conta: o aparelho deixa de receber os avisos deste músico. Idempotente — quem já não tem token recebe o mesmo 204.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async clearPushToken(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.clearPushTokenUseCase.execute({ id });
  }

  @Post(":id/verify")
  @HttpCode(200)
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

  /*
   * 🔴 NÃO existe `DELETE /musicians/:id`, e a ausência é a correção
   * (out/2026).
   *
   * A rota apagava a linha de `musicians` a pedido do próprio músico, numa
   * chamada, sem confirmação. Pelo schema a cascata leva carteira, pedidos,
   * biblioteca, repertórios, performances e a linha da assinatura; contrato,
   * custódia, gorjeta e transação ficam com o músico nulo. E o use-case não
   * tocava em mais nada: o login no Keycloak, a cobrança recorrente no
   * provedor e os arquivos no bucket continuavam existindo — conta que loga e
   * não tem perfil, cartão que segue sendo cobrado.
   *
   * "Excluir conta" é um fluxo de produto (exigido pelas lojas), com as suas
   * próprias regras: o que bloqueia, o que se anonimiza, o que a lei manda
   * guardar. Não é um `repository.delete`. Ver
   * `Docs/regras-de-negocio/ainda-nao-implementado.md`.
   */

  @Post(":id/qr-code/customize")
  @HttpCode(200)
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
