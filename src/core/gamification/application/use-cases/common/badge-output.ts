import { Badge } from "../../../domain/badge.aggregate";

export type BadgeOutput = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement: Record<string, any>;
  points: number;
  rarity: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export class BadgeOutputMapper {
  static toOutput(entity: Badge): BadgeOutput {
    const { badge_id, ...otherProps } = entity.toJSON();
    return {
      id: badge_id,
      ...otherProps,
    } as BadgeOutput;
  }
}
