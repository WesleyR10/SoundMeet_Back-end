import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  Establishment,
  EstablishmentId,
} from "../../../domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../domain/establishment.repository";
import {
  EstablishmentOutput,
  EstablishmentOutputMapper,
} from "../common/establishment-output";

export type VerifyEstablishmentInput = { id: string };
export type VerifyEstablishmentOutput = EstablishmentOutput;

export class VerifyEstablishmentUseCase
  implements IUseCase<VerifyEstablishmentInput, VerifyEstablishmentOutput>
{
  constructor(private readonly establishmentRepo: IEstablishmentRepository) {}

  async execute(
    input: VerifyEstablishmentInput,
  ): Promise<VerifyEstablishmentOutput> {
    const entity = await this.establishmentRepo.findById(
      new EstablishmentId(input.id),
    );

    if (!entity) {
      throw new NotFoundError(input.id, Establishment);
    }

    entity.verify();

    await this.establishmentRepo.update(entity);

    return EstablishmentOutputMapper.toOutput(entity);
  }
}
