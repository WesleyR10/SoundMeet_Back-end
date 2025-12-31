import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Audience } from "../../../domain/audience.aggregate";
import { IAudienceRepository } from "../../../domain/audience.repository";
import {
  AudienceOutput,
  AudienceOutputMapper,
} from "../common/audience-output";
import { CreateAudienceInput } from "./create-audience.input";

export class CreateAudienceUseCase implements IUseCase<
  CreateAudienceInput,
  AudienceOutput
> {
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
      favorite_instruments: input.favorite_instruments || [],
      is_active: input.is_active,
    });

    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    await this.audienceRepository.insert(audience);

    return AudienceOutputMapper.toOutput(audience);
  }
}
