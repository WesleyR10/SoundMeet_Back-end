import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
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

import { ListBandsInput } from "../../core/musician/application/use-cases/list-bands/list-bands.input";
import { ListBandsUseCase } from "../../core/musician/application/use-cases/list-bands/list-bands.use-case";
import {
  ApplyChordEditsUseCase,
  CheckPersonalChordSheetAccessUseCase,
  DeletePersonalChordSheetUseCase,
  ForkChordSheetUseCase,
  GetPersonalChordSheetUseCase,
  GetPersonalChordSheetViewUseCase,
  ImportCommunityChordSheetUseCase,
  ListCommunityChordSheetsUseCase,
  ListPersonalChordSheetsUseCase,
  RemoveChordEditUseCase,
  SharePersonalChordSheetUseCase,
  UnsharePersonalChordSheetUseCase,
  UpdatePersonalNotesUseCase,
  UpdateViewSettingsUseCase,
} from "../../core/personal-chord-sheet/application/use-cases/index";
import {
  AuthenticatedUser,
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
  MusicianOwnershipGuard,
  OwnershipParam,
  Roles,
  RolesGuard,
} from "../auth-module";
import { ApplyChordEditsDto } from "./dto/apply-chord-edits.dto";
import { ChordSheetViewQueryDto } from "./dto/chord-sheet-view-query.dto";
import { ForkChordSheetDto } from "./dto/fork-chord-sheet.dto";
import { ImportCommunityChordSheetDto } from "./dto/import-community-chord-sheet.dto";
import { SearchCommunityChordSheetsDto } from "./dto/search-community-chord-sheets.dto";
import { SearchPersonalChordSheetsDto } from "./dto/search-personal-chord-sheets.dto";
import { ShareChordSheetDto } from "./dto/share-chord-sheet.dto";
import { UpdateNotesDto } from "./dto/update-notes.dto";
import { UpdateViewSettingsDto } from "./dto/update-view-settings.dto";
import {
  ImportedChordSheetPresenter,
  PersonalChordSheetCollectionPresenter,
  PersonalChordSheetPresenter,
  PersonalChordSheetSummaryPresenter,
  PersonalChordSheetViewPresenter,
} from "./personal-chord-sheet.presenter";
import { PERSONAL_CHORD_SHEET_COMMUNITY_ENABLED } from "./personal-chord-sheet.providers";

const UUID_PIPE = new ParseUUIDPipe({ errorHttpStatusCode: 422 });

/** Tamanho de página ao varrer as bandas do leitor (ver resolveBandPeers). */
const BAND_PEERS_PAGE_SIZE = 100;

/**
 * ⚠️ O sub-recurso NUNCA se chama `:id`.
 *
 * MusicianOwnershipGuard resolve o dono por FALLBACK_PARAMS = ["musician_id",
 * "musicianId", "id"]. Num `:id` de filho o guard compararia o id do FORK com o
 * do token e daria 403 no dono legítimo. `@OwnershipParam({ param })` fixa a
 * fonte explicitamente, e o nome `:personal_chord_sheet_id` garante que nem o
 * fallback erre. Essa classe de bug já mordeu o projeto duas vezes.
 */
@ApiTags("Personal Chord Sheets")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("musicians/:musician_id/personal-chord-sheets")
export class PersonalChordSheetController {
  @Inject(ForkChordSheetUseCase)
  private forkUseCase: ForkChordSheetUseCase;

  @Inject(GetPersonalChordSheetUseCase)
  private getUseCase: GetPersonalChordSheetUseCase;

  @Inject(GetPersonalChordSheetViewUseCase)
  private getViewUseCase: GetPersonalChordSheetViewUseCase;

  @Inject(ListPersonalChordSheetsUseCase)
  private listUseCase: ListPersonalChordSheetsUseCase;

  @Inject(ApplyChordEditsUseCase)
  private applyEditsUseCase: ApplyChordEditsUseCase;

  @Inject(RemoveChordEditUseCase)
  private removeEditUseCase: RemoveChordEditUseCase;

  @Inject(UpdateViewSettingsUseCase)
  private updateViewUseCase: UpdateViewSettingsUseCase;

  @Inject(UpdatePersonalNotesUseCase)
  private updateNotesUseCase: UpdatePersonalNotesUseCase;

  @Inject(SharePersonalChordSheetUseCase)
  private shareUseCase: SharePersonalChordSheetUseCase;

  @Inject(UnsharePersonalChordSheetUseCase)
  private unshareUseCase: UnsharePersonalChordSheetUseCase;

  @Inject(DeletePersonalChordSheetUseCase)
  private deleteUseCase: DeletePersonalChordSheetUseCase;

  @Post()
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @OwnershipParam({ param: "musician_id" })
  @ApiOperation({
    summary: "Criar a cifra pessoal de uma música (fork)",
    description:
      "Não copia a cifra: grava a âncora (fingerprint da análise vigente) e nasce sem edições. Gate de plano: max_personal_chord_sheets.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiResponse({ status: 201, type: PersonalChordSheetPresenter })
  @ApiResponse({ status: 402, description: "Limite do plano atingido" })
  @ApiResponse({ status: 409, description: "Já existe fork para esta música" })
  async fork(
    @Param("musician_id", UUID_PIPE) musician_id: string,
    @Body() dto: ForkChordSheetDto,
  ) {
    const output = await this.forkUseCase.execute({
      musician_id,
      music_library_id: dto.music_library_id,
    });
    return new PersonalChordSheetPresenter(output);
  }

  @Get()
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @OwnershipParam({ param: "musician_id" })
  @ApiOperation({
    summary: "Listar as cifras pessoais do músico",
    description:
      "Devolve o RESUMO de cada fork (edit_count, não o array de edits).",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiResponse({ status: 200, type: PersonalChordSheetCollectionPresenter })
  async findAll(
    @Param("musician_id", UUID_PIPE) musician_id: string,
    @Query() query: SearchPersonalChordSheetsDto,
  ) {
    const output = await this.listUseCase.execute({
      musician_id,
      music_library_id: query.music_library_id ?? null,
      reconcile_status: query.reconcile_status ?? null,
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
    });
    return new PersonalChordSheetCollectionPresenter(output);
  }

  @Get(":personal_chord_sheet_id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @OwnershipParam({ param: "musician_id" })
  @ApiOperation({ summary: "Buscar uma cifra pessoal pelo id" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "personal_chord_sheet_id", format: "uuid" })
  @ApiResponse({ status: 200, type: PersonalChordSheetPresenter })
  @ApiResponse({ status: 403, description: "A cifra pessoal não é sua" })
  async findOne(
    @Param("musician_id", UUID_PIPE) musician_id: string,
    @Param("personal_chord_sheet_id", UUID_PIPE)
    personal_chord_sheet_id: string,
  ) {
    // O musician_id da URL vai como owner_musician_id porque o guard só provou
    // que ele é o do token — quem confere que o FORK é dele é o use-case. Sem
    // isso, `/musicians/{eu}/personal-chord-sheets/{fork-de-outro}` passava pelo
    // guard e devolvia a cifra privada alheia com as anotações.
    const output = await this.getUseCase.execute({
      personal_chord_sheet_id,
      owner_musician_id: musician_id,
      requesting_musician_id: musician_id,
    });
    return new PersonalChordSheetPresenter(output);
  }

  @Get(":personal_chord_sheet_id/chord-sheet")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @OwnershipParam({ param: "musician_id" })
  @ApiOperation({
    summary: "A cifra com as correções aplicadas, no tom que o músico toca",
    description:
      "Os parâmetros de query sobrepõem a view salva SÓ nesta resposta — nada é persistido.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "personal_chord_sheet_id", format: "uuid" })
  @ApiResponse({ status: 200, type: PersonalChordSheetViewPresenter })
  async chordSheet(
    @Param("musician_id", UUID_PIPE) musician_id: string,
    @Param("personal_chord_sheet_id", UUID_PIPE)
    personal_chord_sheet_id: string,
    @Query() query: ChordSheetViewQueryDto,
  ) {
    const output = await this.getViewUseCase.execute({
      personal_chord_sheet_id,
      owner_musician_id: musician_id,
      view_override: toViewOverride(query),
    });
    return new PersonalChordSheetViewPresenter(output);
  }

  @Post(":personal_chord_sheet_id/edits")
  @HttpCode(200)
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @OwnershipParam({ param: "musician_id" })
  @ApiOperation({
    summary: "Registrar correções de acorde",
    description:
      'mode "append" (padrão) acrescenta; "replace" troca a lista inteira.',
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "personal_chord_sheet_id", format: "uuid" })
  @ApiResponse({ status: 200, type: PersonalChordSheetPresenter })
  async applyEdits(
    @Param("musician_id", UUID_PIPE) musician_id: string,
    @Param("personal_chord_sheet_id", UUID_PIPE)
    personal_chord_sheet_id: string,
    @Body() dto: ApplyChordEditsDto,
  ) {
    const output = await this.applyEditsUseCase.execute({
      personal_chord_sheet_id,
      musician_id,
      edits: dto.edits,
      mode: dto.mode,
    });
    return new PersonalChordSheetPresenter(output);
  }

  @Delete(":personal_chord_sheet_id/edits/:edit_id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @OwnershipParam({ param: "musician_id" })
  @ApiOperation({ summary: "Remover uma correção" })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "personal_chord_sheet_id", format: "uuid" })
  @ApiParam({ name: "edit_id", format: "uuid" })
  @ApiResponse({ status: 200, type: PersonalChordSheetPresenter })
  async removeEdit(
    @Param("musician_id", UUID_PIPE) musician_id: string,
    @Param("personal_chord_sheet_id", UUID_PIPE)
    personal_chord_sheet_id: string,
    @Param("edit_id", UUID_PIPE) edit_id: string,
  ) {
    const output = await this.removeEditUseCase.execute({
      personal_chord_sheet_id,
      musician_id,
      edit_id,
    });
    return new PersonalChordSheetPresenter(output);
  }

  @Patch(":personal_chord_sheet_id/view")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @OwnershipParam({ param: "musician_id" })
  @ApiOperation({
    summary: "Salvar tom, capotraste, instrumento e complexidade",
    description: "PATCH parcial: o que não vier no corpo é preservado.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "personal_chord_sheet_id", format: "uuid" })
  @ApiResponse({ status: 200, type: PersonalChordSheetPresenter })
  async updateView(
    @Param("musician_id", UUID_PIPE) musician_id: string,
    @Param("personal_chord_sheet_id", UUID_PIPE)
    personal_chord_sheet_id: string,
    @Body() dto: UpdateViewSettingsDto,
  ) {
    const output = await this.updateViewUseCase.execute({
      personal_chord_sheet_id,
      musician_id,
      view: { ...dto },
    });
    return new PersonalChordSheetPresenter(output);
  }

  @Patch(":personal_chord_sheet_id/notes")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @OwnershipParam({ param: "musician_id" })
  @ApiOperation({
    summary: "Salvar as anotações pessoais",
    description: "Nunca visíveis para terceiros, nem na comunidade.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "personal_chord_sheet_id", format: "uuid" })
  @ApiResponse({ status: 200, type: PersonalChordSheetPresenter })
  async updateNotes(
    @Param("musician_id", UUID_PIPE) musician_id: string,
    @Param("personal_chord_sheet_id", UUID_PIPE)
    personal_chord_sheet_id: string,
    @Body() dto: UpdateNotesDto,
  ) {
    const output = await this.updateNotesUseCase.execute({
      personal_chord_sheet_id,
      musician_id,
      notes: dto.notes ?? null,
    });
    return new PersonalChordSheetPresenter(output);
  }

  @Post(":personal_chord_sheet_id/share")
  @HttpCode(200)
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @OwnershipParam({ param: "musician_id" })
  @ApiOperation({
    summary: "Compartilhar com a banda ou com a comunidade",
    description:
      "Gate de plano só no escopo community (chord_sheet_community_sharing); compartilhar com a própria banda é core em todos os tiers.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "personal_chord_sheet_id", format: "uuid" })
  @ApiResponse({ status: 200, type: PersonalChordSheetPresenter })
  @ApiResponse({ status: 402, description: "Plano não permite publicar" })
  async share(
    @Param("musician_id", UUID_PIPE) musician_id: string,
    @Param("personal_chord_sheet_id", UUID_PIPE)
    personal_chord_sheet_id: string,
    @Body() dto: ShareChordSheetDto,
  ) {
    const output = await this.shareUseCase.execute({
      personal_chord_sheet_id,
      musician_id,
      scope: dto.scope,
    });
    return new PersonalChordSheetPresenter(output);
  }

  @Delete(":personal_chord_sheet_id/share")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @OwnershipParam({ param: "musician_id" })
  @ApiOperation({
    summary: "Voltar a cifra para privada",
    description: "Efeito imediato — descompartilhar não tem carência.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "personal_chord_sheet_id", format: "uuid" })
  @ApiResponse({ status: 200, type: PersonalChordSheetPresenter })
  async unshare(
    @Param("musician_id", UUID_PIPE) musician_id: string,
    @Param("personal_chord_sheet_id", UUID_PIPE)
    personal_chord_sheet_id: string,
  ) {
    const output = await this.unshareUseCase.execute({
      personal_chord_sheet_id,
      musician_id,
    });
    return new PersonalChordSheetPresenter(output);
  }

  @HttpCode(204)
  @Delete(":personal_chord_sheet_id")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @OwnershipParam({ param: "musician_id" })
  @ApiOperation({
    summary: "Excluir a cifra pessoal",
    description: "A cifra original da IA não é tocada — só o overlay some.",
  })
  @ApiParam({ name: "musician_id", format: "uuid" })
  @ApiParam({ name: "personal_chord_sheet_id", format: "uuid" })
  @ApiResponse({ status: 204, description: "Excluída" })
  async remove(
    @Param("musician_id", UUID_PIPE) musician_id: string,
    @Param("personal_chord_sheet_id", UUID_PIPE)
    personal_chord_sheet_id: string,
  ) {
    await this.deleteUseCase.execute({
      personal_chord_sheet_id,
      requesting_musician_id: musician_id,
    });
  }
}

/**
 * Cifras que outros músicos compartilharam.
 *
 * Sem MusicianOwnershipGuard de propósito: aqui quem lê legitimamente NÃO é o
 * dono. Quem autoriza é o CheckPersonalChordSheetAccessUseCase, pela regra de
 * escopo do agregado — mesmo desenho do CheckRepertoireSongAccessUseCase.
 */
@ApiTags("Community Chord Sheets")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("community/personal-chord-sheets")
export class CommunityChordSheetController {
  @Inject(ListCommunityChordSheetsUseCase)
  private listUseCase: ListCommunityChordSheetsUseCase;

  @Inject(CheckPersonalChordSheetAccessUseCase)
  private checkAccessUseCase: CheckPersonalChordSheetAccessUseCase;

  @Inject(GetPersonalChordSheetUseCase)
  private getUseCase: GetPersonalChordSheetUseCase;

  @Inject(GetPersonalChordSheetViewUseCase)
  private getViewUseCase: GetPersonalChordSheetViewUseCase;

  @Inject(ImportCommunityChordSheetUseCase)
  private importUseCase: ImportCommunityChordSheetUseCase;

  @Inject(ListBandsUseCase)
  private listBandsUseCase: ListBandsUseCase;

  @Inject(PERSONAL_CHORD_SHEET_COMMUNITY_ENABLED)
  private readonly communityEnabled: boolean;

  @Get()
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Listar cifras compartilhadas com a comunidade",
    description: "O escopo community é fixo — nunca vem da query.",
  })
  @ApiResponse({ status: 200, type: PersonalChordSheetCollectionPresenter })
  @ApiResponse({ status: 404, description: "Comunidade desligada" })
  async findAll(@Query() query: SearchCommunityChordSheetsDto) {
    this.assertCommunityEnabled();
    const output = await this.listUseCase.execute({
      music_library_id: query.music_library_id ?? null,
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
    });
    return new PersonalChordSheetCollectionPresenter(output);
  }

  @Get(":personal_chord_sheet_id")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Ver a cifra de outro músico",
    description:
      "Autorizado por escopo: community para qualquer músico, band só para os pares de banda do autor. As anotações pessoais dele nunca vêm.",
  })
  @ApiParam({ name: "personal_chord_sheet_id", format: "uuid" })
  @ApiResponse({ status: 200, type: PersonalChordSheetPresenter })
  @ApiResponse({ status: 403, description: "Sem acesso a esta cifra" })
  async findOne(
    @Param("personal_chord_sheet_id", UUID_PIPE)
    personal_chord_sheet_id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    this.assertCommunityEnabled();
    const access = await this.resolveAccess(
      personal_chord_sheet_id,
      currentUser,
    );

    const output = await this.getUseCase.execute({
      // O DONO resolvido pelo CheckAccess, pelo mesmo motivo da rota
      // /chord-sheet: aqui quem lê legitimamente não é o dono, e é o CheckAccess
      // que autoriza pela regra de escopo do agregado.
      owner_musician_id: access.owner_musician_id,
      personal_chord_sheet_id,
      requesting_musician_id: currentUser.userId,
    });
    return new PersonalChordSheetPresenter(output);
  }

  @Get(":personal_chord_sheet_id/chord-sheet")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Ler a cifra de outro músico já com as correções dele",
  })
  @ApiParam({ name: "personal_chord_sheet_id", format: "uuid" })
  @ApiResponse({ status: 200, type: PersonalChordSheetViewPresenter })
  @ApiResponse({ status: 403, description: "Sem acesso a esta cifra" })
  async chordSheet(
    @Param("personal_chord_sheet_id", UUID_PIPE)
    personal_chord_sheet_id: string,
    @Query() query: ChordSheetViewQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    this.assertCommunityEnabled();
    const access = await this.resolveAccess(
      personal_chord_sheet_id,
      currentUser,
    );

    const output = await this.getViewUseCase.execute({
      personal_chord_sheet_id,
      // ⚠️ O DONO, nunca currentUser.userId: a linha de music_library é dele, e
      // o use-case base lança NotFoundError se o musician_id não bater.
      // Precedente literal: repertoire.controller.ts (chordSheetViaRepertoire).
      owner_musician_id: access.owner_musician_id,
      view_override: toViewOverride(query),
    });
    return new PersonalChordSheetViewPresenter(output);
  }

  @Post(":personal_chord_sheet_id/import")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Importar as correções para a própria cifra",
    description:
      "As edições são REANCORADAS contra a análise do importador; as que não acharem lugar voltam como conflito e não entram. Gate de plano: max_personal_chord_sheets.",
  })
  @ApiParam({ name: "personal_chord_sheet_id", format: "uuid" })
  @ApiResponse({ status: 201, type: ImportedChordSheetPresenter })
  @ApiResponse({ status: 402, description: "Limite do plano atingido" })
  @ApiResponse({ status: 409, description: "Já existe fork para esta música" })
  async import(
    @Param("personal_chord_sheet_id", UUID_PIPE)
    source_personal_chord_sheet_id: string,
    @Body() dto: ImportCommunityChordSheetDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    this.assertCommunityEnabled();
    const output = await this.importUseCase.execute({
      source_personal_chord_sheet_id,
      musician_id: currentUser.userId,
      target_music_library_id: dto.target_music_library_id,
    });
    return new ImportedChordSheetPresenter(output);
  }

  /**
   * Resolve o acesso, incluindo os pares de banda do leitor.
   *
   * Sem os pares, share_scope "band" seria aceito na escrita e ilegível na
   * leitura — a feature ficaria meio quebrada em silêncio.
   */
  private async resolveAccess(
    personal_chord_sheet_id: string,
    currentUser: AuthenticatedUser,
  ) {
    // Admin (moderação) entra sem requesting_musician_id e vê qualquer fork.
    if (currentUser.isAdmin) {
      return this.checkAccessUseCase.execute({ personal_chord_sheet_id });
    }

    return this.checkAccessUseCase.execute({
      personal_chord_sheet_id,
      requesting_musician_id: currentUser.userId,
      requesting_musician_band_peers: await this.resolveBandPeers(
        currentUser.userId,
      ),
    });
  }

  /**
   * Todos os músicos que dividem alguma banda com quem está lendo.
   *
   * `filter.musician_id` é o caminho "minhas bandas" do ListBandsUseCase, que
   * NÃO passa pelo gate de open_to_gigs — é o próprio músico vendo as bandas de
   * que é membro aceito (ver comentário no use-case).
   */
  private async resolveBandPeers(musician_id: string): Promise<string[]> {
    const peers = new Set<string>();

    // Percorre TODAS as páginas. Com uma página só, o par que caísse fora dela
    // levaria 403 num fork que é legitimamente dele para ler — e em silêncio,
    // porque truncamento e "não é seu par de banda" são indistinguíveis daqui.
    for (let page = 1; ; page++) {
      const result = await this.listBandsUseCase.execute(
        new ListBandsInput({
          page,
          per_page: BAND_PEERS_PAGE_SIZE,
          filter: { musician_id },
        }),
      );

      for (const band of result.items) {
        for (const member of band.members) {
          // Só membro ACEITO conta: convite pendente não dá acesso a nada.
          if (member.status === "accepted") peers.add(member.musician_id);
        }
      }

      // items vazio também encerra: sem isso um last_page inconsistente daria
      // laço infinito na thread que atende o request.
      if (page >= result.last_page || result.items.length === 0) break;
    }

    return [...peers];
  }

  private assertCommunityEnabled(): void {
    if (!this.communityEnabled) {
      throw new NotFoundException(
        "A comunidade de cifras está temporariamente indisponível.",
      );
    }
  }
}

/**
 * Moderação. Só admin — o RolesGuard é a única barreira necessária aqui, e é
 * de propósito: o takedown existe justamente para agir sobre fork alheio.
 */
@ApiTags("Personal Chord Sheets (Admin)")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("admin/personal-chord-sheets")
export class PersonalChordSheetAdminController {
  @Inject(ListCommunityChordSheetsUseCase)
  private listUseCase: ListCommunityChordSheetsUseCase;

  @Inject(DeletePersonalChordSheetUseCase)
  private deleteUseCase: DeletePersonalChordSheetUseCase;

  @Get()
  @Roles("admin")
  @ApiOperation({
    summary: "Navegar pelas cifras publicadas (moderação)",
    description:
      "Só o que está publicado na comunidade — moderação atua sobre o que é público, não sobre o caderno privado de ninguém.",
  })
  @ApiResponse({ status: 200, type: PersonalChordSheetCollectionPresenter })
  async findAll(@Query() query: SearchCommunityChordSheetsDto) {
    const output = await this.listUseCase.execute({
      music_library_id: query.music_library_id ?? null,
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
    });
    return new PersonalChordSheetCollectionPresenter(output);
  }

  @HttpCode(204)
  @Delete(":personal_chord_sheet_id")
  @Roles("admin")
  @ApiOperation({
    summary: "Remover qualquer cifra pessoal (takedown)",
    description:
      "requesting_musician_id undefined é o bypass de admin definido em loadOwnedSheet.",
  })
  @ApiParam({ name: "personal_chord_sheet_id", format: "uuid" })
  @ApiResponse({ status: 204, description: "Removida" })
  async remove(
    @Param("personal_chord_sheet_id", UUID_PIPE)
    personal_chord_sheet_id: string,
  ) {
    await this.deleteUseCase.execute({
      personal_chord_sheet_id,
      requesting_musician_id: undefined,
    });
  }
}

// ─── Helpers de controller ───────────────────────────────────────────────────

/** Query vazia = sem override; senão o `with` sobrescreveria com undefined. */
function toViewOverride(query: ChordSheetViewQueryDto) {
  const override = {
    ...(query.transpose_semitones !== undefined && {
      transpose_semitones: query.transpose_semitones,
    }),
    ...(query.capo_fret !== undefined && { capo_fret: query.capo_fret }),
    ...(query.chord_complexity !== undefined && {
      chord_complexity: query.chord_complexity,
    }),
  };
  return Object.keys(override).length > 0 ? override : undefined;
}
