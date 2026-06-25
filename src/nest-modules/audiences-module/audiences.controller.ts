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
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { AttendEventUseCase } from "../../core/audience/application/use-cases/attend-event/attend-event.use-case";
import { AudienceOutput } from "../../core/audience/application/use-cases/common/audience-output";
import { CompleteProfileUseCase } from "../../core/audience/application/use-cases/complete-profile/complete-profile.use-case";
import { CreateAudienceUseCase } from "../../core/audience/application/use-cases/create-audience/create-audience.use-case";
import { DeleteAudienceUseCase } from "../../core/audience/application/use-cases/delete-audience/delete-audience.use-case";
import { GetAudienceUseCase } from "../../core/audience/application/use-cases/get-audience/get-audience.use-case";
import { IndicateMusicianUseCase } from "../../core/audience/application/use-cases/indicate-musician/indicate-musician.use-case";
import { ListAudiencesUseCase } from "../../core/audience/application/use-cases/list-audiences/list-audiences.use-case";
import { MakeMusicRequestUseCase } from "../../core/audience/application/use-cases/make-music-request/make-music-request.use-case";
import { RecommendMusiciansUseCase } from "../../core/audience/application/use-cases/recommend-musicians/recommend-musicians.use-case";
import { ScanQRUseCase } from "../../core/audience/application/use-cases/scan-qr/scan-qr.use-case";
import { SendTipUseCase } from "../../core/audience/application/use-cases/send-tip/send-tip.use-case";
import { ShareSocialMediaUseCase } from "../../core/audience/application/use-cases/share-social-media/share-social-media.use-case";
import { UpdateAudienceUseCase } from "../../core/audience/application/use-cases/update-audience/update-audience.use-case";
import { VoteSongUseCase } from "../../core/audience/application/use-cases/vote-song/vote-song.use-case";
import {
  AudienceOwnershipGuard,
  AuthGuard,
  CurrentUserContextGuard,
  Public,
  Roles,
  RolesGuard,
} from "../auth-module";
import { MusicianCollectionPresenter } from "../musicians-module/musician.presenter";
import {
  AudienceCollectionPresenter,
  AudiencePresenter,
  MakeMusicRequestPresenter,
  ScanQRPresenter,
  SendTipPresenter,
} from "./audience.presenter";
import { AttendEventDto } from "./dto/attend-event.dto";
import { CompleteProfileDto } from "./dto/complete-profile.dto";
import { CreateAudienceDto } from "./dto/create-audience.dto";
import { IndicateMusicianDto } from "./dto/indicate-musician.dto";
import { MakeMusicRequestDto } from "./dto/make-music-request.dto";
import { RecommendMusiciansDto } from "./dto/recommend-musicians.dto";
import { ScanQRDto } from "./dto/scan-qr.dto";
import { SearchAudiencesDto } from "./dto/search-audiences.dto";
import { SendTipDto } from "./dto/send-tip.dto";
import { ShareSocialMediaDto } from "./dto/share-social-media.dto";
import { UpdateAudienceDto } from "./dto/update-audience.dto";
import { VoteSongDto } from "./dto/vote-song.dto";

@ApiTags("Audience")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("audiences")
export class AudiencesController {
  @Inject(CreateAudienceUseCase)
  private createUseCase: CreateAudienceUseCase;

  @Inject(UpdateAudienceUseCase)
  private updateUseCase: UpdateAudienceUseCase;

  @Inject(DeleteAudienceUseCase)
  private deleteUseCase: DeleteAudienceUseCase;

  @Inject(GetAudienceUseCase)
  private getUseCase: GetAudienceUseCase;

  @Inject(ListAudiencesUseCase)
  private listUseCase: ListAudiencesUseCase;

  @Inject(CompleteProfileUseCase)
  private completeProfileUseCase: CompleteProfileUseCase;

  @Inject(AttendEventUseCase)
  private attendEventUseCase: AttendEventUseCase;

  @Inject(ScanQRUseCase)
  private scanQRUseCase: ScanQRUseCase;

  @Inject(MakeMusicRequestUseCase)
  private makeMusicRequestUseCase: MakeMusicRequestUseCase;

  @Inject(VoteSongUseCase)
  private voteSongUseCase: VoteSongUseCase;

  @Inject(SendTipUseCase)
  private sendTipUseCase: SendTipUseCase;

  @Inject(ShareSocialMediaUseCase)
  private shareSocialMediaUseCase: ShareSocialMediaUseCase;

  @Inject(IndicateMusicianUseCase)
  private indicateMusicianUseCase: IndicateMusicianUseCase;

  @Inject(RecommendMusiciansUseCase)
  private recommendMusiciansUseCase: RecommendMusiciansUseCase;

  @Post()
  @Public()
  @ApiOperation({
    summary: "Criar usuário do público",
    description: "Cria um usuário do público com preferências e gamificação.",
  })
  @ApiResponse({ status: 201, type: AudiencePresenter })
  async create(@Body() createAudienceDto: CreateAudienceDto) {
    const output = await this.createUseCase.execute(createAudienceDto);
    return AudiencesController.serialize(output);
  }

  @Get()
  @Roles("admin")
  @ApiOperation({
    summary: "Listar usuários do público",
    description:
      "Lista usuários do público com paginação, ordenação e filtros.",
  })
  @ApiResponse({ status: 200, type: AudienceCollectionPresenter })
  async findAll(@Query() query: SearchAudiencesDto) {
    const output = await this.listUseCase.execute(query);
    return new AudienceCollectionPresenter(output);
  }

  @Get(":id")
  @Roles("audience", "admin")
  @ApiOperation({
    summary: "Buscar usuário do público por ID",
    description: "Retorna os detalhes do perfil do público.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: AudiencePresenter })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getUseCase.execute({ id });
    return AudiencesController.serialize(output);
  }

  @Patch(":id")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Atualizar usuário do público",
    description: "Atualiza dados do perfil do público.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: AudiencePresenter })
  async update(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() updateAudienceDto: UpdateAudienceDto,
  ) {
    const output = await this.updateUseCase.execute({
      id,
      name: updateAudienceDto.name,
      nickname: updateAudienceDto.nickname,
      avatar: updateAudienceDto.avatar,
      phone: updateAudienceDto.phone,
      favorite_genres: updateAudienceDto.favorite_genres,
      favorite_artists: updateAudienceDto.favorite_artists,
      favorite_instruments: updateAudienceDto.favorite_instruments,
      is_active: updateAudienceDto.is_active,
    });
    return AudiencesController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Remover usuário do público",
    description: "Remove o perfil do público.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async remove(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.deleteUseCase.execute({ id });
  }

  @Patch(":id/complete-profile")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Completar perfil do público",
    description: "Completa o perfil e atualiza configurações e preferências.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: AudiencePresenter })
  async completeProfile(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() body: CompleteProfileDto,
  ) {
    const output = await this.completeProfileUseCase.execute({
      audience_id: id,
      name: body.name,
      nickname: body.nickname,
      avatar: body.avatar,
      phone: body.phone,
      favorite_genres: body.favorite_genres,
      favorite_artists: body.favorite_artists,
      favorite_instruments: body.favorite_instruments,
      notification_settings: body.notification_settings,
      privacy_settings: body.privacy_settings,
      discovery_settings: body.discovery_settings,
    });
    return AudiencesController.serialize(output);
  }

  @Post(":id/scan-qr")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Escanear QR Code",
    description: "Registra scan de QR Code e aplica pontuação/gamificação.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: ScanQRPresenter })
  async scanQR(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() body: ScanQRDto,
  ) {
    const output = await this.scanQRUseCase.execute({
      id,
      qr_code: body.qr_code,
      musician_id: body.musician_id,
      establishment_id: body.establishment_id,
      event_id: body.event_id,
      location: body.location,
      metadata: body.metadata,
    });
    return new ScanQRPresenter(output);
  }

  @Post(":id/music-requests")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Fazer pedido musical",
    description: "Cria um pedido musical e aplica pontuação/gamificação.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: MakeMusicRequestPresenter })
  async makeMusicRequest(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() body: MakeMusicRequestDto,
  ) {
    const output = await this.makeMusicRequestUseCase.execute({
      id,
      musician_id: body.musician_id,
      song_title: body.song_title,
      artist_name: body.artist_name,
      genre: body.genre,
      difficulty: body.difficulty,
      event_id: body.event_id,
      establishment_id: body.establishment_id,
      message: body.message,
      is_priority: body.is_priority,
      metadata: body.metadata,
    });
    return new MakeMusicRequestPresenter(output);
  }

  @Post(":id/votes")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Votar em música",
    description: "Registra voto e aplica pontuação/gamificação.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: AudiencePresenter })
  async voteSong(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() body: VoteSongDto,
  ) {
    const output = await this.voteSongUseCase.execute({
      audience_id: id,
      request_id: body.request_id,
      vote: body.vote,
    });
    return AudiencesController.serialize(output);
  }

  @Post(":id/tips")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Enviar gorjeta",
    description: "Registra gorjeta e aplica pontuação/gamificação.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: SendTipPresenter })
  async sendTip(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() body: SendTipDto,
  ) {
    const output = await this.sendTipUseCase.execute({
      id,
      musician_id: body.musician_id,
      amount: body.amount,
      message: body.message,
      payment_method: body.payment_method,
      event_id: body.event_id,
      establishment_id: body.establishment_id,
      is_anonymous: body.is_anonymous,
      metadata: body.metadata,
    });
    return new SendTipPresenter(output);
  }

  @Post(":id/social-shares")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Compartilhar em rede social",
    description: "Registra compartilhamento e aplica pontuação/gamificação.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: AudiencePresenter })
  async shareSocialMedia(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() body: ShareSocialMediaDto,
  ) {
    const output = await this.shareSocialMediaUseCase.execute({
      audience_id: id,
      request_id: body.request_id,
      platform: body.platform,
      message: body.message,
    });
    return AudiencesController.serialize(output);
  }

  @Post(":id/indications")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Indicar músico para estabelecimento",
    description: "Registra indicação e aplica pontuação/gamificação.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: AudiencePresenter })
  async indicateMusician(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() body: IndicateMusicianDto,
  ) {
    const output = await this.indicateMusicianUseCase.execute({
      audience_id: id,
      musician_id: body.musician_id,
      establishment_id: body.establishment_id,
      message: body.message,
    });
    return AudiencesController.serialize(output);
  }

  @Post(":id/attend-event")
  @Roles("audience", "admin")
  @UseGuards(AudienceOwnershipGuard)
  @ApiOperation({
    summary: "Participar de evento",
    description: "Registra participação em evento e aplica pontuação.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: AudiencePresenter })
  async attendEvent(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() body: AttendEventDto,
  ) {
    const output = await this.attendEventUseCase.execute({
      audience_id: id,
      event_id: body.event_id,
      establishment_id: body.establishment_id,
    });
    return AudiencesController.serialize(output);
  }

  @Get(":id/recommendations/musicians")
  @Roles("audience", "admin")
  @ApiOperation({
    summary: "Recomendar músicos para o público",
    description:
      "Recomenda músicos com base nas preferências do público (instrumentos/gêneros).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: MusicianCollectionPresenter })
  async recommendMusicians(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query() query: RecommendMusiciansDto,
  ) {
    const output = await this.recommendMusiciansUseCase.execute({
      audience_id: id,
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
      only_active: query.only_active,
    });
    return new MusicianCollectionPresenter(output);
  }

  static serialize(output: AudienceOutput) {
    return new AudiencePresenter(output);
  }
}
