import { AggregateRoot, Uuid } from "../../shared/domain";
import { ValueObject } from "../../shared/domain/value-object";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { BadgeValidatorFactory } from "./badge.validator";
import { BadgeFakeBuilder } from "./badge-fake.builder";

export type BadgeConstructorProps = {
  id?: BadgeId;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  requirement: Record<string, any>;
  points: number;
  rarity: BadgeRarity;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
};

export type BadgeCreateCommand = {
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  requirement: Record<string, any>;
  points?: number;
  rarity?: BadgeRarity;
  is_active?: boolean;
};

export type BadgeCategory = "engagement" | "support" | "discovery" | "social";
export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

export class BadgeId extends Uuid {}

export class Badge extends AggregateRoot {
  id: BadgeId;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  requirement: Record<string, any>;
  points: number;
  rarity: BadgeRarity;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(props: BadgeConstructorProps) {
    super();
    this.id = props.id ?? new BadgeId();
    this.name = props.name;
    this.description = props.description;
    this.icon = props.icon;
    this.category = props.category;
    this.requirement = props.requirement;
    this.points = props.points ?? 0;
    this.rarity = props.rarity ?? "common";
    this.is_active = props.is_active ?? true;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): ValueObject {
    return this.id;
  }

  static create(props: BadgeCreateCommand): Badge {
    const badge = new Badge({
      name: props.name,
      description: props.description,
      icon: props.icon,
      category: props.category,
      requirement: props.requirement,
      points: props.points ?? 0,
      rarity: props.rarity ?? "common",
      is_active: props.is_active,
    });
    badge.validate();

    if (badge.notification.hasErrors()) {
      throw new EntityValidationError(badge.notification.toJSON());
    }

    return badge;
  }

  changeName(name: string): void {
    this.name = name;
    this.updated_at = new Date();
    const isValid = this.validate(["name"]);
    if (!isValid) {
      throw new EntityValidationError(this.notification.toJSON());
    }
  }

  changeDescription(description: string): void {
    this.description = description;
    this.updated_at = new Date();
    const isValid = this.validate(["description"]);
    if (!isValid) {
      throw new EntityValidationError(this.notification.toJSON());
    }
  }

  changeIcon(icon: string): void {
    this.icon = icon;
    this.updated_at = new Date();
    this.validate(["icon"]);
  }

  updateRequirement(requirement: Record<string, any>): void {
    this.requirement = requirement;
    this.updated_at = new Date();
    this.validate(["requirement"]);
  }

  changeRequirement(requirement: Record<string, any>): void {
    this.updateRequirement(requirement);
  }

  updatePoints(points: number): void {
    this.points = points;
    this.updated_at = new Date();
    const isValid = this.validate(["points"]);
    if (!isValid) {
      throw new EntityValidationError(this.notification.toJSON());
    }
  }

  changePoints(points: number): void {
    this.updatePoints(points);
  }

  changeRarity(rarity: BadgeRarity): void {
    this.rarity = rarity;
    this.updated_at = new Date();
    this.validate(["rarity"]);
  }

  changeCategory(category: BadgeCategory): void {
    this.category = category;
    this.updated_at = new Date();
    this.validate(["category"]);
  }

  activate(): void {
    this.is_active = true;
    this.updated_at = new Date();
  }

  deactivate(): void {
    this.is_active = false;
    this.updated_at = new Date();
  }

  get isRare(): boolean {
    return (
      this.rarity === "rare" ||
      this.rarity === "epic" ||
      this.rarity === "legendary"
    );
  }

  get isLegendary(): boolean {
    return this.rarity === "legendary";
  }

  validate(fields?: string[]) {
    const validator = BadgeValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return BadgeFakeBuilder;
  }

  toJSON() {
    return {
      id: this.id.id,
      name: this.name,
      description: this.description,
      icon: this.icon,
      category: this.category,
      requirement: this.requirement,
      points: this.points,
      rarity: this.rarity,
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
