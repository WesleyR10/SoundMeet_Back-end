import { Band } from "../../../domain/band.aggregate";

export type BandOutput = {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  genres: string[];
  members: any[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export class BandOutputMapper {
  static toOutput(entity: Band): BandOutput {
    return {
      id: entity.band_id.id,
      name: entity.name,
      description: entity.description,
      avatar: entity.avatar,
      genres: entity.genres,
      members: entity.members,
      is_active: entity.is_active,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}
