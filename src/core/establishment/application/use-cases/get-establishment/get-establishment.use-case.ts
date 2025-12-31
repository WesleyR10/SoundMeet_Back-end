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

export class GetEstablishmentUseCase implements IUseCase<
  GetEstablishmentInput,
  GetEstablishmentOutput
> {
  constructor(private readonly establishmentRepo: IEstablishmentRepository) {}

  async execute(input: GetEstablishmentInput): Promise<GetEstablishmentOutput> {
    const establishmentId = new EstablishmentId(input.id);
    const entity = await this.establishmentRepo.findById(establishmentId);

    if (!entity) {
      throw new NotFoundError(input.id, Establishment);
    }

    return EstablishmentOutputMapper.toOutput(entity);
  }
}

export type GetEstablishmentInput = {
  id: string;
};

export type GetEstablishmentOutput = EstablishmentOutput;
