import { Band, BandId } from "../../../domain/band.aggregate";
import { BandMemberProps } from "../../../domain/band.aggregate";

export type BandModelProps = {
  id: string;
  name: string;
  description?: string | null;
  avatar?: string | null;
  genres: string[];
  members: any[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export class BandModelMapper {
  static toModel(entity: Band): BandModelProps {
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

  static toEntity(model: BandModelProps): Band {
    return new Band({
      band_id: new BandId(model.id),
      name: model.name,
      description: model.description ?? undefined,
      avatar: model.avatar ?? undefined,
      genres: model.genres,
      members: model.members as BandMemberProps[],
      is_active: model.is_active,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
