import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  Establishment,
  EstablishmentId,
} from "../../../domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../domain/establishment.repository";

export class DeleteEstablishmentProfileUseCase implements IUseCase<
  DeleteEstablishmentProfileInput,
  DeleteEstablishmentProfileOutput
> {
  constructor(private readonly establishmentRepo: IEstablishmentRepository) {}

  async execute(
    input: DeleteEstablishmentProfileInput,
  ): Promise<DeleteEstablishmentProfileOutput> {
    const establishmentId = new EstablishmentId(input.id);
    const entity = await this.establishmentRepo.findById(establishmentId);

    if (!entity) {
      throw new NotFoundError(input.id, Establishment);
    }

    await this.establishmentRepo.deleteProfile(establishmentId);
  }
}

export type DeleteEstablishmentProfileInput = {
  id: string;
};

export type DeleteEstablishmentProfileOutput = void;
