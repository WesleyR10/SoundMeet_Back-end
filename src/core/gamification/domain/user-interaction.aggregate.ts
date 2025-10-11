import { ValueObject } from "../../shared/domain/value-object";
import { UserInteractionValidatorFactory } from "./user-interaction.validator";
import { UserInteractionFakeBuilder } from "./user-interaction-fake.builder";
import { AggregateRoot, Uuid } from "../../shared/domain";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { UserInteractionId } from "./value-objects/gamification-id.vo";
import { InteractionMetadata } from "./value-objects/interaction-metadata.vo";

export type UserInteractionConstructorProps = {
  id?: UserInteractionId;
  user_id: string;
  interaction_type: string;
  target_id?: string | null;
  metadata?: InteractionMetadata;
  points_earned?: number;
  created_at?: Date;
  updated_at?: Date;
};

export type UserInteractionCreateCommand = {
  user_id: string;
  interaction_type: string;
  target_id?: string;
  metadata?: InteractionMetadata;
  points_earned?: number;
};

export class UserInteraction extends AggregateRoot {
  id: UserInteractionId;
  user_id: Uuid;
  interaction_type: string;
  target_id: string | null;
  metadata: InteractionMetadata;
  points_earned: number;
  created_at: Date;
  updated_at: Date;

  constructor(props: UserInteractionConstructorProps, id?: UserInteractionId) {
    super();
    this.id = id ?? props.id ?? new UserInteractionId();
    this.user_id = new Uuid(props.user_id);
    this.interaction_type = props.interaction_type;
    this.target_id = props.target_id ?? null;
    this.metadata = props.metadata ?? null;
    this.points_earned = props.points_earned ?? 0;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): ValueObject {
    return this.id;
  }

  static create(command: UserInteractionCreateCommand): UserInteraction {
    return new UserInteraction({
      user_id: command.user_id,
      interaction_type: command.interaction_type,
      target_id: command.target_id,
      metadata: command.metadata,
      points_earned: command.points_earned,
    });
  }

  changeInteractionType(type: string): void {
    if (!type || type.trim().length === 0) {
      this.notification.addError(
        "Interaction type cannot be empty",
        "interaction_type",
      );
      return;
    }
    this.interaction_type = type;
    this.updated_at = new Date();
    this.validate(["interaction_type"]);
  }

  updateMetadata(metadata: Record<string, any>): void {
    this.metadata = metadata;
    this.updated_at = new Date();
  }

  changeMetadata(metadata: Record<string, any> | null | undefined): void {
    this.metadata = metadata ?? null;
    this.updated_at = new Date();
  }

  changeTargetId(targetId: string | null | undefined): void {
    this.target_id = targetId ?? null;
    this.updated_at = new Date();
  }

  updatePointsEarned(points: number): void {
    if (points < 0) {
      this.notification.addError(
        "Points earned cannot be negative",
        "points_earned",
      );
      return;
    }
    this.points_earned = points;
    this.updated_at = new Date();
    this.validate(["points_earned"]);
  }

  isQrScanInteraction(): boolean {
    return this.interaction_type === "qr_scan";
  }

  isMusicRequestInteraction(): boolean {
    return this.interaction_type === "music_request";
  }

  isTipInteraction(): boolean {
    return this.interaction_type === "tip";
  }

  isSocialShareInteraction(): boolean {
    return this.interaction_type === "social_share";
  }

  getInteractionDescription(): string {
    const descriptions = {
      qr_scan: "QR Code Scan",
      music_request: "Music Request",
      tip: "Tip Sent",
      social_share: "Social Media Share",
      badge_unlock: "Badge Unlocked",
      level_up: "Level Up",
    };
    return descriptions[this.interaction_type] || "Unknown Interaction";
  }

  validate(fields?: string[]): void {
    const validator = UserInteractionValidatorFactory.create();
    const isValid = validator.validate(this.notification, this, fields);
    if (!isValid) {
      throw new EntityValidationError(this.notification.toJSON());
    }
  }

  static fake() {
    return UserInteractionFakeBuilder;
  }

  toJSON() {
    return {
      id: this.id.id,
      user_id: this.user_id.id,
      interaction_type: this.interaction_type,
      target_id: this.target_id,
      metadata: this.metadata,
      points_earned: this.points_earned,
      is_qr_scan: this.isQrScanInteraction(),
      is_music_request: this.isMusicRequestInteraction(),
      is_tip: this.isTipInteraction(),
      is_social_share: this.isSocialShareInteraction(),
      description: this.getInteractionDescription(),
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
