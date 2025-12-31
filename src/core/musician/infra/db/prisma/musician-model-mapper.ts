import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";

export type MusicianModelProps = {
  id: string;
  email: string;
  name: string;
  stage_name?: string | null;
  bio?: string | null;
  avatar?: string | null;
  phone?: string | null;
  genres?: string[];
  instruments?: string[];
  experience_years?: number | null;
  qr_code?: string | null;
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
};

export class MusicianModelMapper {
  static toModel(entity: Musician): MusicianModelProps {
    return {
      id: entity.id.id,
      email: entity.email.value,
      name: entity.name,
      stage_name: entity.stage_name ?? null,
      bio: entity.bio ?? null,
      avatar: entity.avatar ?? null,
      phone: entity.phone?.value ?? null,
      genres: entity.genres ?? [],
      instruments: entity.instruments ?? [],
      experience_years: entity.experience_years ?? null,
      qr_code: entity.qr_code?.code ?? null,
      rating: entity.rating.value,
      total_ratings: entity.total_ratings,
      is_active: entity.is_active,
      is_verified: entity.is_verified,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: MusicianModelProps): Musician {
    const musician = new Musician({
      id: new MusicianId(model.id),
      email: model.email,
      name: model.name,
      stage_name: model.stage_name ?? undefined,
      bio: model.bio ?? undefined,
      avatar: model.avatar ?? undefined,
      phone: model.phone ?? undefined,
      genres: model.genres ?? [],
      instruments: model.instruments ?? [],
      experience_years: model.experience_years ?? undefined,
      qr_code: model.qr_code ?? undefined,
      rating: model.rating,
      total_ratings: model.total_ratings,
      is_active: model.is_active,
      is_verified: model.is_verified,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });

    musician.validate();

    if (musician.notification.hasErrors()) {
      throw new LoadEntityError(musician.notification.toJSON());
    }

    return musician;
  }
}
