import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Availability } from "../../../domain/availability.aggregate";
import { IAvailabilityRepository } from "../../../domain/availability.repository";
import {
  AvailabilityOutput,
  AvailabilityOutputMapper,
} from "../common/availability-output";
import { RemoveUnavailabilityInput } from "./remove-unavailability.input";

export class RemoveUnavailabilityUseCase
  implements IUseCase<RemoveUnavailabilityInput, AvailabilityOutput>
{
  constructor(private readonly availabilityRepo: IAvailabilityRepository) {}

  async execute(
    input: RemoveUnavailabilityInput,
  ): Promise<AvailabilityOutput> {
    const entity = await this.availabilityRepo.findByMusicianId(
      input.musician_id,
    );
    if (!entity) {
      throw new NotFoundError(input.musician_id, Availability);
    }

    entity.removeUnavailability(input.block_id);

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.availabilityRepo.update(entity);
    return AvailabilityOutputMapper.toOutput(entity);
  }
}

export type RemoveUnavailabilityOutput = AvailabilityOutput;
