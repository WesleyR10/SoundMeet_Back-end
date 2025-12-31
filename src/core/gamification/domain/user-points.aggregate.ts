import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { ValueObject } from "../../shared/domain/value-object";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { UserPointsValidatorFactory } from "./user-points.validator";
import { UserPointsFakeBuilder } from "./user-points-fake.builder";
import { PointsSource } from "./value-objects/points-source.vo";
import { UserLevel } from "./value-objects/user-level.vo";

export type UserPointsConstructorProps = {
  id?: UserPointsId;
  user_id: Uuid;
  total_points?: number;
  total_scans?: number;
  total_requests?: number;
  total_tips?: number;
  total_social_shares?: number;
  current_level?: number;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
};

export type UserPointsCreateCommand = {
  user_id: string;
  total_points?: number;
  total_scans?: number;
  total_requests?: number;
  total_tips?: number;
  total_social_shares?: number;
  current_level?: number;
  is_active?: boolean;
};

export class UserPointsId extends Uuid {}

export class UserPoints extends AggregateRoot {
  id: UserPointsId;
  user_id: Uuid;
  total_points: number;
  total_scans: number;
  total_requests: number;
  total_tips: number;
  total_social_shares: number;
  current_level: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(props: UserPointsConstructorProps) {
    super();
    this.id = props.id ?? new UserPointsId();
    this.user_id = props.user_id;
    this.total_points = props.total_points ?? 0;
    this.total_scans = props.total_scans ?? 0;
    this.total_requests = props.total_requests ?? 0;
    this.total_tips = props.total_tips ?? 0;
    this.total_social_shares = props.total_social_shares ?? 0;
    this.current_level = props.current_level ?? 1;
    this.is_active = props.is_active ?? true;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): ValueObject {
    return this.id;
  }

  get user_points_id(): UserPointsId {
    return this.id;
  }

  static create(command: UserPointsCreateCommand): UserPoints {
    const props: UserPointsConstructorProps = {
      ...command,
      user_id: new Uuid(command.user_id),
    };
    const userPoints = new UserPoints(props);
    userPoints.validate(["user_id"]);
    return userPoints;
  }

  validate(fields?: string[]): boolean {
    const validator = UserPointsValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  scanQr(): void {
    this.total_scans += 1;
    this.addPointsFromSource(PointsSource.scanQr());
    this.updateLevel();
    this.updated_at = new Date();
  }

  makeMusicRequest(): void {
    this.total_requests += 1;
    this.addPointsFromSource(PointsSource.request());
    this.updateLevel();
    this.updated_at = new Date();
  }

  acceptedMusicRequest(): void {
    this.addPointsFromSource(PointsSource.acceptedRequest());
    this.updateLevel();
    this.updated_at = new Date();
  }

  sendTip(amount: number): void {
    this.total_tips += amount;
    const tipPoints = amount * PointsSource.tip().getPointsValue();
    this.addPoints(tipPoints);
    this.updateLevel();
    this.updated_at = new Date();
  }

  shareOnSocial(): void {
    this.total_social_shares += 1;
    this.addPointsFromSource(PointsSource.socialShare());
    this.updateLevel();
    this.updated_at = new Date();
  }

  addPoints(points: number): void {
    if (points < 0) {
      throw new Error("Points cannot be negative");
    }
    this.total_points += points;
    this.updateLevel();
    this.updated_at = new Date();
    this.validate(["total_points"]);
  }

  subtractPoints(points: number): void {
    const newTotal = this.total_points - points;
    this.total_points = newTotal < 0 ? 0 : newTotal;
    this.updateLevel();
    this.updated_at = new Date();
    this.validate(["total_points"]);
  }

  addPointsFromSource(source: PointsSource): void {
    this.addPoints(source.getPointsValue());
  }

  updateTotalPoints(points: number): void {
    this.total_points = points;
    this.updateLevel();
    this.updated_at = new Date();
    this.validate(["total_points"]);
  }

  updateTotalScans(scans: number): void {
    this.total_scans = scans;
    this.updated_at = new Date();
    this.validate(["total_scans"]);
  }

  updateTotalRequests(requests: number): void {
    this.total_requests = requests;
    this.updated_at = new Date();
    this.validate(["total_requests"]);
  }

  updateTotalTips(tips: number): void {
    this.total_tips = tips;
    this.updated_at = new Date();
    this.validate(["total_tips"]);
  }

  updateTotalSocialShares(shares: number): void {
    this.total_social_shares = shares;
    this.updated_at = new Date();
    this.validate(["total_social_shares"]);
  }

  updateCurrentLevel(level: number): void {
    this.current_level = level;
    this.updated_at = new Date();
    this.validate(["current_level"]);
  }

  updateLevel(level?: number): void {
    if (level !== undefined) {
      this.current_level = level;
      this.updated_at = new Date();
      this.validate(["current_level"]);
    } else {
      const newLevel = UserLevel.getLevelByPoints(this.total_points);
      this.current_level = newLevel.level;
    }
  }

  activate(): void {
    this.is_active = true;
    this.updated_at = new Date();
  }

  deactivate(): void {
    this.is_active = false;
    this.updated_at = new Date();
  }

  getUserLevel(): UserLevel {
    return UserLevel.getLevelByPoints(this.total_points);
  }

  needsLevelUp(): boolean {
    const currentLevelInfo = UserLevel.getLevelByPoints(this.total_points);
    return currentLevelInfo.level > this.current_level;
  }

  getCurrentLevel(): UserLevel {
    return UserLevel.getLevelByPoints(this.total_points);
  }

  getProgressToNextLevel(): number {
    const currentLevel = this.getCurrentLevel();
    return currentLevel.getProgressToNextLevel(this.total_points);
  }

  get isTopFan(): boolean {
    return this.total_points >= 1000;
  }

  get isActiveSupporter(): boolean {
    return this.total_tips > 0 && this.total_social_shares > 0;
  }

  static fake() {
    return UserPointsFakeBuilder;
  }

  toJSON() {
    const levelInfo = this.getUserLevel();
    return {
      id: this.id.id,
      user_id: this.user_id.id,
      total_points: this.total_points,
      total_scans: this.total_scans,
      total_requests: this.total_requests,
      total_tips: this.total_tips,
      total_social_shares: this.total_social_shares,
      current_level: this.current_level,
      level_info: {
        level: levelInfo.level,
        name: levelInfo.name,
        min_points: levelInfo.minPoints,
        max_points: levelInfo.maxPoints,
        benefits: levelInfo.benefits,
      },
      progress_to_next_level: this.getProgressToNextLevel(),
      is_active: this.is_active,
      is_top_fan: this.isTopFan,
      is_active_supporter: this.isActiveSupporter,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
