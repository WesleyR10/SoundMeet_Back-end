import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import { IAudienceRepository } from "../../../domain/audience.repository";
import {
  AudienceOutput,
  AudienceOutputMapper,
} from "../common/audience-output";
import { UpdateAudienceInput } from "./update-audience.input";

export class UpdateAudienceUseCase
  implements IUseCase<UpdateAudienceInput, UpdateAudienceOutput>
{
  constructor(private readonly audienceRepo: IAudienceRepository) {}

  async execute(input: UpdateAudienceInput): Promise<UpdateAudienceOutput> {
    const audienceId = new AudienceId(input.id);
    const audience = await this.audienceRepo.findById(audienceId);

    if (!audience) {
      throw new NotFoundError(input.id, Audience);
    }

    if (input.name !== undefined) {
      audience.changeName(input.name);
    }

    if (input.nickname !== undefined) {
      audience.changeNickname(input.nickname);
    }

    if (input.avatar !== undefined) {
      audience.changeAvatar(input.avatar);
    }

    if (input.phone !== undefined) {
      audience.changePhone(input.phone);
    }

    if (input.favorite_genres !== undefined) {
      audience.updateFavoriteGenres(input.favorite_genres);
    }

    if (input.favorite_artists !== undefined) {
      audience.updateFavoriteArtists(input.favorite_artists);
    }

    if (input.favorite_instruments !== undefined) {
      audience.updatePreferences({
        favorite_artists: input.favorite_instruments, // Note: This might need to be mapped differently based on your domain logic
      });
    }

    if (input.is_active !== undefined) {
      if (input.is_active) {
        audience.activate();
      } else {
        audience.deactivate();
      }
    }

    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    await this.audienceRepo.update(audience);

    return AudienceOutputMapper.toOutput(audience);
  }
}

export type UpdateAudienceOutput = AudienceOutput;
