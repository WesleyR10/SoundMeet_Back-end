import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { ListMusicLibraryUseCase } from "../../core/music-library/application/use-cases/list-music-library/list-music-library.use-case";
import {
  AuthGuard,
  CurrentUserContextGuard,
  Public,
  RolesGuard,
} from "../auth-module";
import { SearchPublicRepertoireDto } from "./dto/search-public-repertoire.dto";
import { PublicMusicLibraryCollectionPresenter } from "./public-music-library.presenter";

/**
 * Catálogo de músicas de um músico, visível a quem vai **pedir** (Bloco 9.6c).
 *
 * Existe como controller separado — e não relaxando `MusicLibraryController`,
 * que é `@Roles("musician","admin")` na classe inteira — por dois motivos:
 *
 * 1. **Segurança por construção.** Afrouxar a rota genérica exigiria lembrar,
 *    em toda mudança futura, de não deixar `chords`/`lyrics` escaparem no
 *    presenter. Aqui a rota nasce com um presenter que só sabe montar
 *    metadado; não há como vazar por esquecimento.
 * 2. **`musician_id` é obrigatório na URL.** Nunca existe "listar a biblioteca
 *    inteira" para terceiro — `MusicLibrary` é biblioteca **pessoal**, cada
 *    músico tem a própria linha da mesma música.
 *
 * Mesmo precedente de controller transversal dentro de um módulo já existente
 * usado por `AiCifraSearchController` (6.6) e `EventsDiscoveryController` (7.13b).
 */
@ApiTags("Music Library")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("musicians")
export class PublicRepertoireController {
  @Inject(ListMusicLibraryUseCase)
  private listUseCase: ListMusicLibraryUseCase;

  @Get(":musician_id/repertoire")
  @Public()
  // Catálogo é conteúdo raspável. O teto global (100/min) já cobre, mas um
  // limite próprio evita que a página pública vire fonte barata de scraping.
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @ApiOperation({
    summary: "Repertório público de um músico",
    description:
      "Metadado apenas — título, artista, gênero, dificuldade e duração — para o fã identificar a música ao fazer um pedido. NUNCA devolve acordes, cifra, letra ou anotações privadas: conteúdo de cifra tem risco de licenciamento e anotação é do músico.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: PublicMusicLibraryCollectionPresenter })
  async list(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musicianId: string,
    @Query() query: SearchPublicRepertoireDto,
  ) {
    const output = await this.listUseCase.execute({
      page: query.page,
      per_page: query.per_page,
      sort: query.sort,
      sort_dir: query.sort_dir,
      filter: {
        // Vem do PATH, não da query: o cliente escolhe DE QUEM é o repertório,
        // nunca "de todos". Sobrescreve qualquer musician_id que venha junto.
        musician_id: musicianId,
        title: query.title ?? null,
        artist: query.artist ?? null,
        genre: query.genre ?? null,
      },
    });

    return new PublicMusicLibraryCollectionPresenter(output);
  }
}
