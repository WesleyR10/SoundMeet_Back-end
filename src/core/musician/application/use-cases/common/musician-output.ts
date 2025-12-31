import { Musician } from "../../../domain/musician.aggregate";

export type MusicianOutput = {
  id: string;
  email: string;
  name: string;
  stage_name: string | null;
  bio: string | null;
  avatar: string | null;
  phone: string | null;
  genres: string[];
  instruments: string[];
  experience_years: number;
  qr_code: string | null;
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;

  updated_at: Date;
  display_name: string;
  is_experienced: boolean;
  is_highly_rated: boolean;
};

export class MusicianOutputMapper {
  static toOutput(entity: Musician): MusicianOutput {
    const { id, ...otherProps } = entity.toJSON();
    return {
      id: id,
      ...otherProps,
    } as MusicianOutput;
  }
}
