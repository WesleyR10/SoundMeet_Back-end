import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import { IAudienceRepository } from "../../../domain/audience.repository";
import {
  AudienceOutput,
  AudienceOutputMapper,
} from "../common/audience-output";
import { VoteSongInput } from "./vote-song.input";

export class VoteSongUseCase
  implements IUseCase<VoteSongInput, AudienceOutput>
{
  constructor(private audienceRepository: IAudienceRepository) {}

  async execute(input: VoteSongInput): Promise<AudienceOutput> {
    const audienceId = new AudienceId(input.audience_id);
    const audience = await this.audienceRepository.findById(audienceId);
    if (!audience) {
      throw new NotFoundError(input.audience_id, Audience);
    }

    // Verificar se o audience está ativo
    if (!audience.is_active) {
      throw new Error("Audience is not active");
    }

    // Votar na música
    audience.voteForSong(input.request_id, input.vote);

    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    await this.audienceRepository.update(audience);

    return AudienceOutputMapper.toOutput(audience);
  }
}
