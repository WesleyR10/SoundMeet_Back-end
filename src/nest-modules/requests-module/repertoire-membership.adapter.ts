import { Inject, Injectable } from "@nestjs/common";

import { MusicLibraryId } from "../../core/music-library/domain/music-library.aggregate";
import { IMusicLibraryRepository } from "../../core/music-library/domain/music-library.repository";
import { IRepertoireMembershipPort } from "../../core/request/domain/ports/repertoire-membership.port";

/**
 * Confere se a linha de biblioteca citada no pedido é do músico a quem o
 * pedido é feito. Ver `IRepertoireMembershipPort`.
 *
 * `findById` e comparação de dono, em vez de um `exists(id, musician_id)` no
 * repositório: a pergunta é do domínio de `request`, não da biblioteca, e
 * `MusicLibrary` já traz `musician_id`.
 */
@Injectable()
export class RepertoireMembershipAdapter implements IRepertoireMembershipPort {
  constructor(
    @Inject("MusicLibraryRepository")
    private readonly musicLibraryRepo: IMusicLibraryRepository,
  ) {}

  async belongsToMusician(
    library_id: string,
    musician_id: string,
  ): Promise<boolean> {
    let entity: Awaited<ReturnType<IMusicLibraryRepository["findById"]>>;
    try {
      entity = await this.musicLibraryRepo.findById(
        new MusicLibraryId(library_id),
      );
    } catch {
      // `library_id` que não é UUID vem do cliente e não é caso excepcional:
      // é uma resposta "não, não é dele" como qualquer outra.
      return false;
    }
    return entity?.musician_id.id === musician_id;
  }
}
