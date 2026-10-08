import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";
import { SetMusicianRequestScopeInput } from "./set-musician-request-scope.input";

export type SetMusicianRequestScopeOutput = MusicianOutput;

/**
 * Liga/desliga o pedido de música fora do repertório.
 *
 * Use case próprio, e não um campo a mais no `UpdateMusicianUseCase`, pelo
 * mesmo motivo de `SetMusicianOpenToGigsUseCase`: é um interruptor com efeito
 * de regra de negócio, tocado de uma tela de configuração — não um campo de
 * perfil que viaja junto com nome e bio num PATCH grande.
 */
export class SetMusicianRequestScopeUseCase implements IUseCase<
  SetMusicianRequestScopeInput,
  SetMusicianRequestScopeOutput
> {
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(
    input: SetMusicianRequestScopeInput,
  ): Promise<SetMusicianRequestScopeOutput> {
    const entity = await this.musicianRepo.findById(new MusicianId(input.id));

    if (!entity) {
      throw new NotFoundError(input.id, Musician);
    }

    entity.setAcceptsRequestsOutsideRepertoire(
      input.accepts_requests_outside_repertoire,
    );

    await this.musicianRepo.update(entity);

    return MusicianOutputMapper.toOutput(entity);
  }
}
