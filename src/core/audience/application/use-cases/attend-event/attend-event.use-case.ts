import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import { IAudienceRepository } from "../../../domain/audience.repository";
import {
  AudienceOutput,
  AudienceOutputMapper,
} from "../common/audience-output";
import { AttendEventInput } from "./attend-event.input";

export class AttendEventUseCase implements IUseCase<
  AttendEventInput,
  AudienceOutput
> {
  constructor(
    private audienceRepository: IAudienceRepository,
    private readonly addEventAttendeeUseCase: IUseCase<any, any>,
  ) {}

  async execute(input: AttendEventInput): Promise<AudienceOutput> {
    const audienceId = new AudienceId(input.audience_id);
    const audience = await this.audienceRepository.findById(audienceId);
    if (!audience) {
      throw new NotFoundError(input.audience_id, Audience);
    }

    audience.ensureIsActive();
    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    if (!input.establishment_id) {
      throw new InvalidArgumentError(
        "establishment_id is required to register event attendance",
      );
    }

    await this.addEventAttendeeUseCase.execute({
      establishment_id: input.establishment_id,
      event_id: input.event_id,
      audience_id: input.audience_id,
    });

    return AudienceOutputMapper.toOutput(audience);
  }
}
