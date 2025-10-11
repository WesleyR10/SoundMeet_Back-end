import {
  Badge,
  BadgeId,
  BadgeCategory,
  BadgeRarity,
} from "../../../domain/badge.aggregate";
import { JsonValue } from "@prisma/client/runtime/library";

export type BadgeModelProps = {
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
  updated_at?: Date;
};

export type BadgePrismaModel = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement: JsonValue;
  points: number;
  rarity: string;
  is_active: boolean;
  created_at: Date;
};

export class BadgeModelMapper {
  static toModel(entity: Badge): BadgeModelProps {
    return {
      id: entity.id.id,
      name: entity.name,
      description: entity.description,
      icon: entity.icon,
      category: entity.category,
      requirement: entity.requirement,
      points: entity.points,
      rarity: entity.rarity,
      is_active: entity.is_active,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: BadgePrismaModel): Badge {
    return new Badge({
      id: new BadgeId(model.id),
      name: model.name,
      description: model.description,
      icon: model.icon,
      category: model.category as BadgeCategory,
      requirement: (model.requirement as Record<string, any>) || {},
      points: model.points,
      rarity: model.rarity as BadgeRarity,
      is_active: model.is_active,
      created_at: model.created_at,
      updated_at: model.created_at,
    });
  }
}
