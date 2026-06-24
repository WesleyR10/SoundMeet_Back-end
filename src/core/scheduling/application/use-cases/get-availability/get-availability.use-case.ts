import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Availability } from "../../../domain/availability.aggregate";
import { IAvailabilityRepository } from "../../../domain/availability.repository";
import {
  AvailabilityOutput,
  AvailabilityOutputMapper,
} from "../common/availability-output";
import { GetAvailabilityInput } from "./get-availability.input";

export class GetAvailabilityUseCase
  implements IUseCase<GetAvailabilityInput, AvailabilityOutput>
{
  constructor(private readonly availabilityRepo: IAvailabilityRepository) {}

  async execute(input: GetAvailabilityInput): Promise<AvailabilityOutput> {
    const entity = await this.availabilityRepo.findByMusicianId(
      input.musician_id,
    );
    if (!entity) {
      throw new NotFoundError(input.musician_id, Availability);
    }
    return AvailabilityOutputMapper.toOutput(entity);
  }
}

export type GetAvailabilityOutput = AvailabilityOutput;
