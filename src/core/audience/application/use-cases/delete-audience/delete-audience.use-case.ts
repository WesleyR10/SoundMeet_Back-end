import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import { IAudienceRepository } from "../../../domain/audience.repository";
import { DeleteAudienceInput } from "./delete-audience.input";

export class DeleteAudienceUseCase
  implements IUseCase<DeleteAudienceInput, void>
{
  constructor(private readonly audienceRepo: IAudienceRepository) {}

  async execute(input: DeleteAudienceInput): Promise<void> {
    const audienceId = new AudienceId(input.id);
    const audience = await this.audienceRepo.findById(audienceId);

    if (!audience) {
      throw new NotFoundError(input.id, Audience);
    }

    await this.audienceRepo.delete(audienceId);
  }
}
