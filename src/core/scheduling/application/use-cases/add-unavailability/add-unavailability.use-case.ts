import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Availability } from "../../../domain/availability.aggregate";
import { IAvailabilityRepository } from "../../../domain/availability.repository";
import {
  AvailabilityOutput,
  AvailabilityOutputMapper,
} from "../common/availability-output";
import { AddUnavailabilityInput } from "./add-unavailability.input";

export class AddUnavailabilityUseCase
  implements IUseCase<AddUnavailabilityInput, AvailabilityOutput>
{
  constructor(private readonly availabilityRepo: IAvailabilityRepository) {}

  async execute(input: AddUnavailabilityInput): Promise<AvailabilityOutput> {
    let entity = await this.availabilityRepo.findByMusicianId(input.musician_id);

    if (!entity) {
      entity = Availability.create({ musician_id: input.musician_id });
      if (entity.notification.hasErrors()) {
        throw new EntityValidationError(entity.notification.toJSON());
      }
      await this.availabilityRepo.insert(entity);
    }

    entity.addUnavailability(input.start_at, input.end_at, input.reason);

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.availabilityRepo.update(entity);
    return AvailabilityOutputMapper.toOutput(entity);
  }
}

export type AddUnavailabilityOutput = AvailabilityOutput;
