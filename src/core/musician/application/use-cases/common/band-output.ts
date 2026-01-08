import { Currency } from "../../../../shared/domain/value-objects/money.vo";
import { PriceModel } from "../../../../shared/domain/value-objects/price-range.vo";
import { Band } from "../../../domain/band.aggregate";

export type BandMemberOutput = {
  member_id: string;
  musician_id: string;
  role: string;
  instrument: string;
  joined_at: Date;
};

export type BandPriceRangeOutput = {
  model: PriceModel;
  min: number;
  max: number;
  currency: Currency;
  notes: string | null;
};

export type BandOutput = {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  genres: string[];
  members: BandMemberOutput[];
  priceRange: BandPriceRangeOutput | null;
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
      members: entity.members.map((member) => ({
        member_id: member.member_id!.id,
        musician_id: member.musician_id.id,
        role: member.role,
        instrument: member.instrument,
        joined_at: member.joined_at,
      })),
      priceRange: entity.priceRange
        ? {
            model: entity.priceRange.model,
            min: entity.priceRange.min,
            max: entity.priceRange.max,
            currency: entity.priceRange.currency,
            notes: entity.priceRange.notes,
          }
        : null,
      is_active: entity.is_active,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}
