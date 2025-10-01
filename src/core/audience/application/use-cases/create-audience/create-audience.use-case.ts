import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Audience } from "../../../domain/audience.aggregate";
import { IAudienceRepository } from "../../../domain/audience.repository";
import { CreateAudienceInput } from "./create-audience.input";
import {
  AudienceOutputMapper,
  AudienceOutput,
} from "../common/audience-output";

export class CreateAudienceUseCase
  implements IUseCase<CreateAudienceInput, AudienceOutput>
{
  constructor(private audienceRepository: IAudienceRepository) {}

  async execute(input: CreateAudienceInput): Promise<AudienceOutput> {
    const audience = Audience.create({
      name: input.name,
      email: input.email,
      nickname: input.nickname,
      avatar: input.avatar,
      phone: input.phone,
      favorite_genres: input.favorite_genres || [],
      favorite_artists: input.favorite_artists || [],
      is_active: input.is_active,
    });

    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    await this.audienceRepository.insert(audience);

    return AudienceOutputMapper.toOutput(audience);
  }
}
