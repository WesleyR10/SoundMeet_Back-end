import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  Availability,
  AvailabilityId,
} from "../../../domain/availability.aggregate";
import { IAvailabilityRepository } from "../../../domain/availability.repository";
import {
  AvailabilityOutput,
  AvailabilityOutputMapper,
} from "../common/availability-output";
import { SetAvailabilitySettingsInput } from "./set-availability-settings.input";

export class SetAvailabilitySettingsUseCase
  implements IUseCase<SetAvailabilitySettingsInput, AvailabilityOutput>
{
  constructor(private readonly availabilityRepo: IAvailabilityRepository) {}

  async execute(
    input: SetAvailabilitySettingsInput,
  ): Promise<AvailabilityOutput> {
    let entity = await this.availabilityRepo.findByMusicianId(input.musician_id);

    if (!entity) {
      entity = Availability.create({ musician_id: input.musician_id });
      if (entity.notification.hasErrors()) {
        throw new EntityValidationError(entity.notification.toJSON());
      }
      await this.availabilityRepo.insert(entity);
    }

    entity.updateSettings({
      ...(input.timezone != null && { timezone: input.timezone }),
      ...(input.default_buffer_minutes != null && {
        default_buffer_minutes: input.default_buffer_minutes,
      }),
      ...(input.max_shows_per_day !== undefined && {
        max_shows_per_day: input.max_shows_per_day,
      }),
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.availabilityRepo.update(entity);
    return AvailabilityOutputMapper.toOutput(entity);
  }
}

export type SetAvailabilitySettingsOutput = AvailabilityOutput;
