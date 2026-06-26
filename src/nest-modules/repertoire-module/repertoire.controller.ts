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

import {
  AddSongUseCase,
  CreateRepertoireUseCase,
  DeleteRepertoireUseCase,
  GetRepertoireUseCase,
  GetSharedRepertoireUseCase,
  InviteMusicianUseCase,
  ListMyInvitesUseCase,
  ListRepertoiresUseCase,
  RemoveSongUseCase,
  RenameRepertoireUseCase,
  ReorderSongsUseCase,
  RevokeInviteUseCase,
  ShareRepertoireUseCase,
  UnshareRepertoireUseCase,
} from "../../core/repertoire/application/use-cases/index";
import { RepertoireOutput } from "../../core/repertoire/application/use-cases/common/repertoire-output";
import {
  AuthGuard,
  AuthenticatedUser,
  CurrentUser,
  CurrentUserContextGuard,
  MusicianOwnershipGuard,
  Public,
  Roles,
  RolesGuard,
} from "../auth-module";
import { AddSongDto } from "./dto/add-song.dto";
import { CreateRepertoireDto } from "./dto/create-repertoire.dto";
import { InviteMusicianDto } from "./dto/invite-musician.dto";
import { RenameRepertoireDto } from "./dto/rename-repertoire.dto";
import { ReorderSongsDto } from "./dto/reorder-songs.dto";
import { SearchRepertoiresDto } from "./dto/search-repertoires.dto";
import {
  RepertoireCollectionPresenter,
  RepertoirePresenter,
} from "./repertoire.presenter";

const UUID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: 422 });

@ApiTags("Repertoires")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("musicians/:musician_id/repertoires")
export class RepertoireController {
  @Inject(CreateRepertoireUseCase)
  private createUseCase: CreateRepertoireUseCase;

  @Inject(GetRepertoireUseCase)
  private getUseCase: GetRepertoireUseCase;

  @Inject(ListRepertoiresUseCase)
  private listUseCase: ListRepertoiresUseCase;

  @Inject(RenameRepertoireUseCase)
  private renameUseCase: RenameRepertoireUseCase;

  @Inject(DeleteRepertoireUseCase)
  private deleteUseCase: DeleteRepertoireUseCase;

  @Inject(AddSongUseCase)
  private addSongUseCase: AddSongUseCase;

  @Inject(RemoveSongUseCase)
  private removeSongUseCase: RemoveSongUseCase;

  @Inject(ReorderSongsUseCase)
  private reorderSongsUseCase: ReorderSongsUseCase;

  @Inject(ShareRepertoireUseCase)
  private shareUseCase: ShareRepertoireUseCase;

  @Inject(UnshareRepertoireUseCase)
  private unshareUseCase: UnshareRepertoireUseCase;

  @Inject(InviteMusicianUseCase)
  private inviteUseCase: InviteMusicianUseCase;

  @Inject(RevokeInviteUseCase)
  private revokeInviteUseCase: RevokeInviteUseCase;

  // --- CRUD principal ---

  @Post()
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({ summary: "Criar repertório", description: "Gate de plano: max_repertoires." })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiResponse({ status: 201, type: RepertoirePresenter })
  async create(
    @Param("musician_id", UUID_PIPE) musician_id: string,
    @Body() dto: CreateRepertoireDto,
  ) {
    const output = await this.createUseCase.execute({
      musician_id,
      name: dto.name,
    });
    return RepertoireController.serialize(output);
  }

  @Get()
  @Roles("musician", "admin")
  @ApiOperation({ summary: "Listar repertórios do músico" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiResponse({ status: 200, type: RepertoireCollectionPresenter })
  async findAll(
    @Param("musician_id", UUID_PIPE) musician_id: string,
    @Query() query: SearchRepertoiresDto,
  ) {
    const output = await this.listUseCase.execute({
      musician_id,
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
      name: query.name ?? null,
    });
    return new RepertoireCollectionPresenter(output);
  }

  @Get(":id")
  @Roles("musician", "admin")
  @ApiOperation({ summary: "Buscar repertório por ID" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, type: RepertoirePresenter })
  async findOne(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("id", UUID_PIPE) id: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    // Admin sempre vê como owner; outros músicos são identificados pelo userId real
    const requestingId = currentUser?.isAdmin ? undefined : currentUser?.userId;
    const output = await this.getUseCase.execute({
      repertoire_id: id,
      requesting_musician_id: requestingId,
    });
    return RepertoireController.serialize(output);
  }

  @Patch(":id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({ summary: "Renomear repertório" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, type: RepertoirePresenter })
  async rename(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("id", UUID_PIPE) id: string,
    @Body() dto: RenameRepertoireDto,
  ) {
    const output = await this.renameUseCase.execute({
      repertoire_id: id,
      name: dto.name,
    });
    return RepertoireController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({ summary: "Excluir repertório" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 204 })
  async remove(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("id", UUID_PIPE) id: string,
  ) {
    await this.deleteUseCase.execute({ repertoire_id: id });
  }

  // --- Songs ---

  @Post(":id/songs")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Adicionar música ao repertório",
    description: "Gate de plano: max_songs_per_repertoire.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, type: RepertoirePresenter })
  async addSong(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("id", UUID_PIPE) repertoire_id: string,
    @Body() dto: AddSongDto,
  ) {
    const output = await this.addSongUseCase.execute({
      repertoire_id,
      music_library_id: dto.music_library_id,
      custom_notes: dto.custom_notes ?? null,
      duration_override_seconds: dto.duration_override_seconds ?? null,
    });
    return RepertoireController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id/songs/:song_id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({ summary: "Remover música do repertório" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiParam({ name: "song_id", format: "uuid" })
  @ApiResponse({ status: 204 })
  async removeSong(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("id", UUID_PIPE) repertoire_id: string,
    @Param("song_id", UUID_PIPE) song_id: string,
  ) {
    await this.removeSongUseCase.execute({ repertoire_id, song_id });
  }

  @Patch(":id/songs")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Reordenar músicas",
    description: "Recebe todos os song_ids na nova ordem. Posições recalculadas 1..N.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, type: RepertoirePresenter })
  async reorderSongs(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("id", UUID_PIPE) repertoire_id: string,
    @Body() dto: ReorderSongsDto,
  ) {
    const output = await this.reorderSongsUseCase.execute({
      repertoire_id,
      ordered_song_ids: dto.ordered_song_ids,
    });
    return RepertoireController.serialize(output);
  }

  // --- Sharing ---

  @Post(":id/share")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Ativar compartilhamento público (ESSENTIAL/PRO)",
    description: "Gera token de compartilhamento com 7 dias de expiração.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, type: RepertoirePresenter })
  async share(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("id", UUID_PIPE) repertoire_id: string,
  ) {
    const output = await this.shareUseCase.execute({ repertoire_id });
    return RepertoireController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id/share")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({ summary: "Desativar compartilhamento público" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 204 })
  async unshare(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("id", UUID_PIPE) repertoire_id: string,
  ) {
    await this.unshareUseCase.execute({ repertoire_id });
  }

  // --- Nominal invites ---

  @Post(":id/invites")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Convidar músico nominalmente (PRO)",
    description: "Gate de plano: repertoire_nominal_invite.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, type: RepertoirePresenter })
  async invite(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("id", UUID_PIPE) repertoire_id: string,
    @Body() dto: InviteMusicianDto,
  ) {
    const output = await this.inviteUseCase.execute({
      repertoire_id,
      invitee_musician_id: dto.invitee_musician_id,
    });
    return RepertoireController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id/invites/:invitee_id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({ summary: "Revogar convite nominal" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiParam({ name: "invitee_id", format: "uuid" })
  @ApiResponse({ status: 204 })
  async revokeInvite(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("id", UUID_PIPE) repertoire_id: string,
    @Param("invitee_id", UUID_PIPE) invitee_id: string,
  ) {
    await this.revokeInviteUseCase.execute({ repertoire_id, invitee_id });
  }

  static serialize(output: RepertoireOutput): RepertoirePresenter {
    return new RepertoirePresenter(output);
  }
}

// --- Controlador separado para rotas públicas e de convites ---
@ApiTags("Repertoires")
@Controller("repertoires")
export class RepertoirePublicController {
  @Inject(GetSharedRepertoireUseCase)
  private getSharedUseCase: GetSharedRepertoireUseCase;

  @Public()
  @Get("shared/:token")
  @ApiOperation({
    summary: "Acessar repertório compartilhado publicamente",
    description: "Busca repertório por token público. Token tem 7 dias de expiração.",
  })
  @ApiParam({ name: "token", format: "uuid" })
  @ApiResponse({ status: 200, type: RepertoirePresenter })
  async getShared(@Param("token", UUID_PIPE) token: string) {
    const output = await this.getSharedUseCase.execute({ token });
    return new RepertoirePresenter(output);
  }
}

@ApiTags("Repertoires")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("musicians/:musician_id/repertoire-invites")
export class RepertoireInvitesController {
  @Inject(ListMyInvitesUseCase)
  private listMyInvitesUseCase: ListMyInvitesUseCase;

  @Get()
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Listar repertórios que fui convidado",
    description: "Retorna os repertórios de outros músicos onde o músico autenticado é um convidado.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiResponse({ status: 200, type: [RepertoirePresenter] })
  async listMyInvites(
    @Param("musician_id", UUID_PIPE) musician_id: string,
  ) {
    const outputs = await this.listMyInvitesUseCase.execute({ musician_id });
    return outputs.map((o) => new RepertoirePresenter(o));
  }
}
