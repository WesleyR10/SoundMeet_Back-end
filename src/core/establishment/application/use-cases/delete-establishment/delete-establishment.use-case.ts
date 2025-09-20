import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Establishment } from "../../../domain/establishment.aggregate";
import { EstablishmentId } from "../../../domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../domain/establishment.repository";

export class DeleteEstablishmentUseCase
  implements IUseCase<DeleteEstablishmentInput, DeleteEstablishmentOutput>
{
  constructor(private readonly establishmentRepo: IEstablishmentRepository) {}

  async execute(
    input: DeleteEstablishmentInput,
  ): Promise<DeleteEstablishmentOutput> {
    const establishmentId = new EstablishmentId(input.id);
    const entity = await this.establishmentRepo.findById(establishmentId);

    if (!entity) {
      throw new NotFoundError(input.id, Establishment);
    }

    await this.establishmentRepo.delete(establishmentId);
  }
}

export type DeleteEstablishmentInput = {
  id: string;
};

export type DeleteEstablishmentOutput = void;
