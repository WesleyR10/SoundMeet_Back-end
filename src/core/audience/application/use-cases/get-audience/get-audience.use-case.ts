import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Audience, AudienceId } from "../../../domain";
import { IAudienceRepository } from "../../../domain/audience.repository";
import {
  AudienceOutput,
  AudienceOutputMapper,
} from "../common/audience-output";
import { GetAudienceInput } from "./get-audience.input";

export class GetAudienceUseCase implements IUseCase<
  GetAudienceInput,
  GetAudienceOutput
> {
  constructor(private readonly audienceRepo: IAudienceRepository) {}

  async execute(input: GetAudienceInput): Promise<GetAudienceOutput> {
    const audienceId = new AudienceId(input.id);
    const audience = await this.audienceRepo.findById(audienceId);

    if (!audience) {
      throw new NotFoundError(input.id, Audience);
    }

    return AudienceOutputMapper.toOutput(audience);
  }
}

export type GetAudienceOutput = AudienceOutput;
