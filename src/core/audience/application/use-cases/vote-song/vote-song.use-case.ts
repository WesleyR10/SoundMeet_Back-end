import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import { IAudienceRepository } from "../../../domain/audience.repository";
import {
  AudienceOutput,
  AudienceOutputMapper,
} from "../common/audience-output";
import { VoteSongInput } from "./vote-song.input";

export class VoteSongUseCase implements IUseCase<
  VoteSongInput,
  AudienceOutput
> {
  constructor(
    private audienceRepository: IAudienceRepository,
    private readonly voteRequestUseCase: IUseCase<any, any>,
  ) {}

  async execute(input: VoteSongInput): Promise<AudienceOutput> {
    const audienceId = new AudienceId(input.audience_id);
    const audience = await this.audienceRepository.findById(audienceId);
    if (!audience) {
      throw new NotFoundError(input.audience_id, Audience);
    }

    audience.ensureIsActive();
    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    await this.voteRequestUseCase.execute({
      request_id: input.request_id,
      audience_id: input.audience_id,
      vote_type: input.vote,
    });

    return AudienceOutputMapper.toOutput(audience);
  }
}
