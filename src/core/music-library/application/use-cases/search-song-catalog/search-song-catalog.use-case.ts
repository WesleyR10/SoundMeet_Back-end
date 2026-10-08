import {
  IMusicianRepository,
  Musician,
  MusicianId,
} from "@core/musician/domain";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  IMusicLibraryRepository,
  SongCatalogEntry,
  SongCatalogScope,
} from "../../../domain/music-library.repository";
import { SearchSongCatalogInput } from "./search-song-catalog.input";

const DEFAULT_LIMIT = 20;

export type SearchSongCatalogOutput = {
  /**
   * Onde a busca aconteceu — decidido pelo músico, não pelo cliente. É o que
   * a tela do fã usa para explicar por que uma música pode não aparecer.
   */
  scope: SongCatalogScope;
  items: SongCatalogEntry[];
};

/**
 * Catálogo que o fã usa para escolher a música que vai pedir.
 *
 * ## Uma rota só para os dois modos, de propósito
 *
 * Seria mais simples deixar o cliente chamar "catálogo da plataforma" ou
 * "repertório do músico" conforme o switch. Seria também uma decisão de
 * segurança delegada a quem faz a chamada: bastaria o app esquecer o flag —
 * ou alguém chamar a rota direto — para o catálogo inteiro aparecer para um
 * músico que desligou justamente isso. Aqui o servidor lê o músico e decide;
 * o cliente recebe o `scope` já resolvido e só precisa saber o que dizer.
 *
 * ## O que NUNCA sai daqui
 *
 * O dono de cada linha. `MusicLibrary` é biblioteca pessoal, e a união dessas
 * linhas responde "a plataforma já cifrou esta música", nunca "fulano toca
 * esta música". O único id que sai é `library_id`, e ele é sempre do músico
 * alvo — ver `SongCatalogEntry`.
 */
export class SearchSongCatalogUseCase implements IUseCase<
  SearchSongCatalogInput,
  SearchSongCatalogOutput
> {
  constructor(
    private readonly musicLibraryRepo: IMusicLibraryRepository,
    private readonly musicianRepo: IMusicianRepository,
  ) {}

  async execute(
    input: SearchSongCatalogInput,
  ): Promise<SearchSongCatalogOutput> {
    const musician = await this.musicianRepo.findById(
      new MusicianId(input.musician_id),
    );

    if (!musician) {
      throw new NotFoundError(input.musician_id, Musician);
    }

    const scope: SongCatalogScope = musician.accepts_requests_outside_repertoire
      ? "platform"
      : "repertoire";

    const items = await this.musicLibraryRepo.searchSongCatalog({
      term: input.term?.trim() || null,
      limit: input.limit ?? DEFAULT_LIMIT,
      musician_id: input.musician_id,
      scope,
    });

    return { scope, items };
  }
}
