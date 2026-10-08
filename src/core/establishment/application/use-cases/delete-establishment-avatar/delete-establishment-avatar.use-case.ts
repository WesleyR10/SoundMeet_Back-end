import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  Establishment,
  EstablishmentId,
} from "../../../domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../domain/establishment.repository";
import { IEstablishmentStorage } from "../../ports/establishment-storage.interface";
import {
  EstablishmentOutput,
  EstablishmentOutputMapper,
} from "../common/establishment-output";

export type DeleteEstablishmentAvatarInput = {
  establishment_id: string;
};

export type DeleteEstablishmentAvatarOutput = EstablishmentOutput;

/**
 * Remove a foto de perfil e volta para o ícone padrão.
 *
 * Como na capa, o padrão não é arquivo: é o que o cliente desenha quando
 * `avatar` é `null`. Idempotente — quem não tem foto recebe 200 com
 * `avatar: null`, não 404.
 *
 * ⚠️ Linhas antigas podem ter `avatar` preenchido e `avatar_key` nulo (URL
 * gravada pelo PATCH, que não era objeto nosso). Aí a URL é limpa e o storage
 * não é tocado: não há o que apagar, e tentar apagar uma URL de terceiro como
 * se fosse chave nossa seria, na melhor hipótese, um 404 silencioso.
 */
export class DeleteEstablishmentAvatarUseCase implements IUseCase<
  DeleteEstablishmentAvatarInput,
  DeleteEstablishmentAvatarOutput
> {
  constructor(
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly storage: IEstablishmentStorage,
  ) {}

  async execute(
    input: DeleteEstablishmentAvatarInput,
  ): Promise<DeleteEstablishmentAvatarOutput> {
    const establishmentId = new EstablishmentId(input.establishment_id);
    const establishment =
      await this.establishmentRepo.findById(establishmentId);

    if (!establishment) {
      throw new NotFoundError(input.establishment_id, Establishment);
    }

    const previousKey = establishment.removeAvatar();

    await this.establishmentRepo.update(establishment);

    // Depois do `update`, e sem relançar — mesma ordem da capa.
    if (previousKey) {
      await this.storage
        .deleteObject({ object_key: previousKey })
        .catch(() => undefined);
    }

    return EstablishmentOutputMapper.toOutput(establishment);
  }
}
