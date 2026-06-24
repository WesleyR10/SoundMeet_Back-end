import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Availability } from "../../../domain/availability.aggregate";
import { IAvailabilityRepository } from "../../../domain/availability.repository";
import {
  AvailabilityOutput,
  AvailabilityOutputMapper,
} from "../common/availability-output";
import { SetWeeklyRulesInput } from "./set-weekly-rules.input";

export class SetWeeklyRulesUseCase
  implements IUseCase<SetWeeklyRulesInput, AvailabilityOutput>
{
  constructor(private readonly availabilityRepo: IAvailabilityRepository) {}

  async execute(input: SetWeeklyRulesInput): Promise<AvailabilityOutput> {
    let entity = await this.availabilityRepo.findByMusicianId(input.musician_id);

    if (!entity) {
      entity = Availability.create({ musician_id: input.musician_id });
      if (entity.notification.hasErrors()) {
        throw new EntityValidationError(entity.notification.toJSON());
      }
      await this.availabilityRepo.insert(entity);
    }

    entity.setWeeklyRules(
      input.rules.map((r) => ({
        weekday: r.weekday,
        start_time: r.start_time,
        end_time: r.end_time,
        is_available: r.is_available ?? true,
      })),
    );

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.availabilityRepo.update(entity);
    return AvailabilityOutputMapper.toOutput(entity);
  }
}

export type SetWeeklyRulesOutput = AvailabilityOutput;
