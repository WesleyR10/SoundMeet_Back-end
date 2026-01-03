import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import { IAudienceRepository } from "../../../domain/audience.repository";
import {
  AudienceOutput,
  AudienceOutputMapper,
} from "../common/audience-output";
import { CompleteProfileInput } from "./complete-profile.input";

export class CompleteProfileUseCase implements IUseCase<
  CompleteProfileInput,
  AudienceOutput
> {
  constructor(private audienceRepository: IAudienceRepository) {}

  async execute(input: CompleteProfileInput): Promise<AudienceOutput> {
    const audienceId = new AudienceId(input.audience_id);
    const audience = await this.audienceRepository.findById(audienceId);
    if (!audience) {
      throw new NotFoundError(input.audience_id, Audience);
    }

    audience.ensureIsActive();
    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    // Atualizar dados do perfil se fornecidos
    if (input.name) {
      audience.changeName(input.name);
    }

    if (input.nickname) {
      audience.changeNickname(input.nickname);
    }

    if (input.avatar) {
      audience.changeAvatar(input.avatar);
    }

    if (input.phone) {
      audience.changePhone(input.phone);
    }

    if (input.favorite_genres) {
      audience.updateFavoriteGenres(input.favorite_genres);
    }

    if (input.favorite_artists) {
      audience.updateFavoriteArtists(input.favorite_artists);
    }

    if (input.favorite_instruments) {
      audience.updateFavoriteInstruments(input.favorite_instruments);
    }

    if (input.notification_settings) {
      audience.updateNotificationSettings(input.notification_settings);
    }

    if (input.privacy_settings) {
      audience.updatePrivacySettings(input.privacy_settings);
    }

    if (input.discovery_settings) {
      audience.updateDiscoverySettings(input.discovery_settings);
    }

    // Completar perfil
    audience.completeProfile();

    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    await this.audienceRepository.update(audience);

    return AudienceOutputMapper.toOutput(audience);
  }
}
