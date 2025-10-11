import { ValueObject } from "../../shared/domain/value-object";
import { UserBadgeValidatorFactory } from "./user-badge.validator";
import { UserBadgeFakeBuilder } from "./user-badge-fake.builder";
import { AggregateRoot, Uuid } from "../../shared/domain";
import { UserBadgeId } from "./value-objects/gamification-id.vo";
import { BadgeType, BadgeTypeEnum } from "./value-objects/badge-type.vo";

export type UserBadgeConstructorProps = {
  id?: UserBadgeId;
  user_id: string;
  badge_type: BadgeTypeEnum;
  progress?: number;
  is_unlocked?: boolean;
  unlocked_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
};

export type UserBadgeCreateCommand = {
  user_id: string;
  badge_type: BadgeTypeEnum;
  progress?: number;
  is_unlocked?: boolean;
};

export class UserBadge extends AggregateRoot {
  id: UserBadgeId;
  user_id: Uuid;
  badge_type: BadgeType;
  progress: number;
  is_unlocked: boolean;
  unlocked_at: Date | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: UserBadgeConstructorProps) {
    super();
    this.id = props.id ?? UserBadgeId.create();
    this.user_id = new Uuid(props.user_id);
    this.badge_type = new BadgeType(props.badge_type);
    this.progress = props.progress ?? 0;
    this.is_unlocked = props.is_unlocked ?? false;
    this.unlocked_at = props.unlocked_at ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();

    this.validate();
  }

  get entity_id(): ValueObject {
    return this.id;
  }

  static create(command: UserBadgeCreateCommand): UserBadge {
    const userBadge = new UserBadge({
      user_id: command.user_id,
      badge_type: command.badge_type,
      progress: command.progress ?? 0,
      is_unlocked: command.is_unlocked ?? false,
    });

    userBadge.validate(["user_id", "badge_type"]);
    return userBadge;
  }

  updateProgress(points: number): void {
    if (points < 0) {
      this.notification.addError("Progress cannot be negative", "progress");
      return;
    }

    this.progress = points;
    this.updated_at = new Date();
    this.checkUnlock();
    this.validate(["progress"]);
  }

  addProgress(points: number): void {
    if (points < 0) {
      this.notification.addError(
        "Points to add cannot be negative",
        "progress",
      );
      return;
    }

    this.progress += points;
    this.updated_at = new Date();
    this.checkUnlock();
    this.validate(["progress"]);
  }

  unlock(): void {
    if (!this.canUnlock()) {
      this.notification.addError(
        "Badge cannot be unlocked yet - insufficient progress",
        "unlock",
      );
      return;
    }

    this.is_unlocked = true;
    this.unlocked_at = new Date();
    this.updated_at = new Date();
  }

  private checkUnlock(): void {
    if (!this.is_unlocked && this.canUnlock()) {
      this.unlock();
    }
  }

  canUnlock(): boolean {
    return this.progress >= this.badge_type.getRequiredPoints();
  }

  getProgressPercentage(): number {
    const required = this.badge_type.getRequiredPoints();
    return Math.min((this.progress / required) * 100, 100);
  }

  getRemainingPoints(): number {
    if (this.is_unlocked) return 0;
    return Math.max(this.badge_type.getRequiredPoints() - this.progress, 0);
  }

  getBadgeDescription(): string {
    return this.badge_type.getDescription();
  }

  validate(fields?: string[]): boolean {
    const validator = UserBadgeValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return UserBadgeFakeBuilder;
  }

  toJSON() {
    return {
      id: this.id.id,
      user_id: this.user_id.id,
      badge_type: this.badge_type.value,
      progress: this.progress,
      is_unlocked: this.is_unlocked,
      unlocked_at: this.unlocked_at,
      progress_percentage: this.getProgressPercentage(),
      remaining_points: this.getRemainingPoints(),
      description: this.getBadgeDescription(),
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

export { UserBadgeId };
