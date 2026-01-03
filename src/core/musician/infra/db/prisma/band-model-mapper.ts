import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Band, BandId } from "../../../domain/band.aggregate";

export type BandMemberModelProps = {
  id: string;
  musicianId: string;
  role: string;
  instrument: string;
  joinedAt: Date;
};

export type BandModelProps = {
  id: string;
  name: string;
  description?: string | null;
  avatar?: string | null;
  genres: string[];
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
      is_active: entity.is_active,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(
    model: BandModelProps & { members?: BandMemberModelProps[] },
  ): Band {
    return new Band({
      band_id: new BandId(model.id),
      name: model.name,
      description: model.description ?? undefined,
      avatar: model.avatar ?? undefined,
      genres: model.genres,
      members: (model.members ?? []).map((m) => ({
        member_id: new Uuid(m.id),
        musician_id: new Uuid(m.musicianId),
        role: m.role,
        instrument: m.instrument,
        joined_at: m.joinedAt,
      })),
      is_active: model.is_active,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
