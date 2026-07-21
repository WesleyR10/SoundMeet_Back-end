import { IUseCase } from "../../../../shared/application/use-case.interface";
import { Notification } from "../../../../shared/domain/validators/notification";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Location } from "../../../../shared/domain/value-objects/location.vo";
import { PriceRange } from "../../../../shared/domain/value-objects/price-range.vo";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { MusicianProfile } from "../../../domain/musician-profile.aggregate";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";
import { CreateMusicianInput } from "./create-musician.input";

export class CreateMusicianUseCase implements IUseCase<
  CreateMusicianInput,
  MusicianOutput
> {
  constructor(private readonly musicianRepo: IMusicianRepository) {}

  async execute(input: CreateMusicianInput): Promise<MusicianOutput> {
    const existing = await this.musicianRepo.findByEmail(input.email);
    if (existing) {
      throw new EntityValidationError([
        { email: ["Email already in use by another musician"] },
      ]);
    }

    const musicianId = new MusicianId();
    let profile: MusicianProfile | null = null;

    let priceRanges: PriceRange[] = [];
    if (input.priceRanges?.length) {
      try {
        priceRanges = input.priceRanges.map((props) => new PriceRange(props));
      } catch (error: any) {
        const notification = new Notification();
        notification.addError(
          error?.message ?? "Invalid price range",
          "priceRanges",
        );
        throw new EntityValidationError(notification.toJSON());
      }
    }

    if (input.location || priceRanges.length) {
      profile = MusicianProfile.create({
        musician_id: musicianId,
        location: new Location(input.location ?? {}),
        priceRanges,
        instruments: input.instruments || [],
        genres: input.genres || [],
        experience: input.experience_years ?? 0,
      });
    }

    const entity = Musician.create({
      musician_id: musicianId,
      email: input.email,
      name: input.name,
      stage_name: input.stage_name,
      bio: input.bio,
      avatar: input.avatar,
      phone: input.phone,
      genres: input.genres || [],
      instruments: input.instruments || [],
      experience_years: input.experience_years,
      is_active: input.is_active,
      open_to_gigs: input.open_to_gigs,
      profile: profile,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.musicianRepo.insert(entity);

    return MusicianOutputMapper.toOutput(entity);
  }
}
