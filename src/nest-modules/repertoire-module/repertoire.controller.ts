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
  CheckRepertoireSongAccessUseCase,
  CheckSharedSongAccessUseCase,
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
import { Repertoire } from "../../core/repertoire/domain/repertoire.aggregate";
import { NotFoundError } from "../../core/shared/domain/errors/not-found.error";
import { GetChordSheetForMusicLibraryUseCase } from "../../core/synced-lyrics/application/use-cases/get-chord-sheet-for-music-library/get-chord-sheet-for-music-library.use-case";
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
import { ChordSheetPresenter } from "../synced-lyrics-module/synced-lyrics.presenter";
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

  @Inject(CheckRepertoireSongAccessUseCase)
  private checkSongAccessUseCase: CheckRepertoireSongAccessUseCase;

  @Inject(GetChordSheetForMusicLibraryUseCase)
  private getChordSheetUseCase: GetChordSheetForMusicLibraryUseCase;

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
  @UseGuards(MusicianOwnershipGuard)
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

  @Get(":repertoire_id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({ summary: "Buscar repertório por ID" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "repertoire_id", format: "uuid" })
  @ApiResponse({ status: 200, type: RepertoirePresenter })
  async findOne(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("repertoire_id", UUID_PIPE) repertoire_id: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    // Admin sempre vê como owner; outros músicos são identificados pelo userId real
    const requestingId = currentUser?.isAdmin ? undefined : currentUser?.userId;
    const output = await this.getUseCase.execute({
      repertoire_id,
      requesting_musician_id: requestingId,
    });
    return RepertoireController.serialize(output);
  }

  @Patch(":repertoire_id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({ summary: "Renomear repertório" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "repertoire_id", format: "uuid" })
  @ApiResponse({ status: 200, type: RepertoirePresenter })
  async rename(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("repertoire_id", UUID_PIPE) repertoire_id: string,
    @Body() dto: RenameRepertoireDto,
  ) {
    const output = await this.renameUseCase.execute({
      repertoire_id,
      name: dto.name,
    });
    return RepertoireController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":repertoire_id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({ summary: "Excluir repertório" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "repertoire_id", format: "uuid" })
  @ApiResponse({ status: 204 })
  async remove(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("repertoire_id", UUID_PIPE) repertoire_id: string,
  ) {
    await this.deleteUseCase.execute({ repertoire_id });
  }

  // --- Songs ---

  @Post(":repertoire_id/songs")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Adicionar música ao repertório",
    description: "Gate de plano: max_songs_per_repertoire.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "repertoire_id", format: "uuid" })
  @ApiResponse({ status: 201, type: RepertoirePresenter })
  async addSong(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("repertoire_id", UUID_PIPE) repertoire_id: string,
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
  @Delete(":repertoire_id/songs/:song_id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({ summary: "Remover música do repertório" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "repertoire_id", format: "uuid" })
  @ApiParam({ name: "song_id", format: "uuid" })
  @ApiResponse({ status: 204 })
  async removeSong(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("repertoire_id", UUID_PIPE) repertoire_id: string,
    @Param("song_id", UUID_PIPE) song_id: string,
  ) {
    await this.removeSongUseCase.execute({ repertoire_id, song_id });
  }

  @Patch(":repertoire_id/songs")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Reordenar músicas",
    description: "Recebe todos os song_ids na nova ordem. Posições recalculadas 1..N.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "repertoire_id", format: "uuid" })
  @ApiResponse({ status: 200, type: RepertoirePresenter })
  async reorderSongs(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("repertoire_id", UUID_PIPE) repertoire_id: string,
    @Body() dto: ReorderSongsDto,
  ) {
    const output = await this.reorderSongsUseCase.execute({
      repertoire_id,
      ordered_song_ids: dto.ordered_song_ids,
    });
    return RepertoireController.serialize(output);
  }

  // NÃO usa MusicianOwnershipGuard de propósito — um convidado nominal
  // legitimamente NÃO é o :musician_id da URL, e esse guard bloquearia
  // exatamente o caso que este endpoint existe pra resolver (mesma classe de
  // bug do B1, evitada aqui por design). A autorização real é inteiramente
  // decidida por CheckRepertoireSongAccessUseCase (dono OU convidado
  // nominal, ver core/repertoire) — o :musician_id na URL só precisa bater
  // com o dono resolvido, checado abaixo por consistência de API.
  @Get(":repertoire_id/songs/:music_library_id/chord-sheet")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Buscar cifra de uma música através de um repertório",
    description:
      "Permite acesso ao dono do repertório OU a um convidado nominal (PRO) listado nele — resolve o gap onde um convidado via lista de músicas mas não conseguia abrir a cifra pra tocar.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "repertoire_id", format: "uuid" })
  @ApiParam({ name: "music_library_id", format: "uuid" })
  @ApiResponse({ status: 200, type: ChordSheetPresenter })
  async chordSheetViaRepertoire(
    @Param("musician_id", UUID_PIPE) musician_id: string,
    @Param("repertoire_id", UUID_PIPE) repertoire_id: string,
    @Param("music_library_id", UUID_PIPE) music_library_id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const access = await this.checkSongAccessUseCase.execute({
      repertoire_id,
      requesting_musician_id: currentUser.userId,
      music_library_id,
    });

    if (access.owner_musician_id !== musician_id) {
      throw new NotFoundError(repertoire_id, Repertoire);
    }

    const output = await this.getChordSheetUseCase.execute({
      musician_id: access.owner_musician_id,
      music_library_id,
    });
    return new ChordSheetPresenter(output);
  }

  // --- Sharing ---

  @Post(":repertoire_id/share")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Ativar compartilhamento público (ESSENTIAL/PRO)",
    description: "Gera token de compartilhamento com 7 dias de expiração.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "repertoire_id", format: "uuid" })
  @ApiResponse({ status: 200, type: RepertoirePresenter })
  async share(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("repertoire_id", UUID_PIPE) repertoire_id: string,
  ) {
    const output = await this.shareUseCase.execute({ repertoire_id });
    return RepertoireController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":repertoire_id/share")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({ summary: "Desativar compartilhamento público" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "repertoire_id", format: "uuid" })
  @ApiResponse({ status: 204 })
  async unshare(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("repertoire_id", UUID_PIPE) repertoire_id: string,
  ) {
    await this.unshareUseCase.execute({ repertoire_id });
  }

  // --- Nominal invites ---

  @Post(":repertoire_id/invites")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({
    summary: "Convidar músico nominalmente (PRO)",
    description: "Gate de plano: repertoire_nominal_invite.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "repertoire_id", format: "uuid" })
  @ApiResponse({ status: 201, type: RepertoirePresenter })
  async invite(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("repertoire_id", UUID_PIPE) repertoire_id: string,
    @Body() dto: InviteMusicianDto,
  ) {
    const output = await this.inviteUseCase.execute({
      repertoire_id,
      invitee_musician_id: dto.invitee_musician_id,
    });
    return RepertoireController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":repertoire_id/invites/:invitee_id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({ summary: "Revogar convite nominal" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "repertoire_id", format: "uuid" })
  @ApiParam({ name: "invitee_id", format: "uuid" })
  @ApiResponse({ status: 204 })
  async revokeInvite(
    @Param("musician_id", UUID_PIPE) _musician_id: string,
    @Param("repertoire_id", UUID_PIPE) repertoire_id: string,
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

  @Inject(CheckSharedSongAccessUseCase)
  private checkSharedSongAccessUseCase: CheckSharedSongAccessUseCase;

  @Inject(GetChordSheetForMusicLibraryUseCase)
  private getChordSheetUseCase: GetChordSheetForMusicLibraryUseCase;

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

  // Público de propósito (sem @CurrentUser, sem guard de auth) — o token já
  // é a prova de acesso, mesmo modelo do getShared acima. Quem consome isso
  // no mobile SoundMeet exige login antes de mostrar a tela (decisão de
  // produto), mas essa é uma escolha do cliente, não uma exigência desta
  // rota — o contrato da API fica simples: token válido = leitura liberada.
  @Public()
  @Get("shared/:token/songs/:music_library_id/chord-sheet")
  @ApiOperation({
    summary: "Buscar cifra de uma música de um repertório compartilhado publicamente",
    description: "Token válido e não expirado + música precisa pertencer ao repertório.",
  })
  @ApiParam({ name: "token", format: "uuid" })
  @ApiParam({ name: "music_library_id", format: "uuid" })
  @ApiResponse({ status: 200, type: ChordSheetPresenter })
  async getSharedChordSheet(
    @Param("token", UUID_PIPE) token: string,
    @Param("music_library_id", UUID_PIPE) music_library_id: string,
  ) {
    const access = await this.checkSharedSongAccessUseCase.execute({
      share_token: token,
      music_library_id,
    });
    const output = await this.getChordSheetUseCase.execute({
      musician_id: access.owner_musician_id,
      music_library_id,
    });
    return new ChordSheetPresenter(output);
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
  @UseGuards(MusicianOwnershipGuard)
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
