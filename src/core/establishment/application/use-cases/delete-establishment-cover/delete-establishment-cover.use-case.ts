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

export type DeleteEstablishmentCoverInput = {
  establishment_id: string;
};

export type DeleteEstablishmentCoverOutput = EstablishmentOutput;

/**
 * Remove a capa enviada e volta para a capa gerada pela marca.
 *
 * Existe porque sem ele a única saída de uma capa ruim seria subir outra —
 * e "voltar ao padrão" é uma decisão legítima, não um estado de erro. O
 * padrão não é um arquivo: é o gradiente + waveform que o cliente desenha
 * quando `cover` é `null`, então remover aqui basta.
 */
export class DeleteEstablishmentCoverUseCase implements IUseCase<
  DeleteEstablishmentCoverInput,
  DeleteEstablishmentCoverOutput
> {
  constructor(
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly storage: IEstablishmentStorage,
  ) {}

  async execute(
    input: DeleteEstablishmentCoverInput,
  ): Promise<DeleteEstablishmentCoverOutput> {
    const establishmentId = new EstablishmentId(input.establishment_id);
    const establishment =
      await this.establishmentRepo.findById(establishmentId);

    if (!establishment) {
      throw new NotFoundError(input.establishment_id, Establishment);
    }

    const previousKey = establishment.removeCover();

    await this.establishmentRepo.update(establishment);

    /*
     * Depois do `update`, e sem relançar — mesma ordem do upload. Se o objeto
     * sair primeiro e a gravação falhar, a página pública fica com uma capa
     * quebrada; nesta ordem o pior caso é um arquivo a mais no bucket.
     */
    if (previousKey) {
      await this.storage
        .deleteObject({ object_key: previousKey })
        .catch(() => undefined);
    }

    return EstablishmentOutputMapper.toOutput(establishment);
  }
}
