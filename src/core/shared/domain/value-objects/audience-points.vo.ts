import { ValueObject } from "../value-object";

export type AudiencePointsProps = {
  total: number;
  monthly: number;
  lastUpdated: Date;
};

export type PointsAction =
  | "scan_qr_code"
  | "make_request"
  | "correct_guess"
  | "send_tip"
  | "share_social"
  | "indicate_musician"
  | "attend_event"
  | "vote_song"
  | "complete_profile";

export class AudiencePoints extends ValueObject {
  readonly total: number;
  readonly monthly: number;
  readonly lastUpdated: Date;

  private static readonly POINTS_VALUES: Record<PointsAction, number> = {
    scan_qr_code: 10,
    make_request: 25,
    correct_guess: 50,
    send_tip: 1, // 1 ponto por real
    share_social: 50,
    indicate_musician: 3,
    attend_event: 30,
    vote_song: 1,
    complete_profile: 10,
  };

  constructor(props: AudiencePointsProps) {
    super();
    this.total = props.total;
    this.monthly = props.monthly;
    this.lastUpdated = props.lastUpdated;
    this.validate();
  }

  static create(): AudiencePoints {
    return new AudiencePoints({
      total: 0,
      monthly: 0,
      lastUpdated: new Date(),
    });
  }

  static fromData(
    total: number,
    monthly: number,
    lastUpdated: Date,
  ): AudiencePoints {
    return new AudiencePoints({
      total,
      monthly,
      lastUpdated,
    });
  }

  addPoints(action: PointsAction, multiplier: number = 1): AudiencePoints {
    const pointsToAdd = AudiencePoints.POINTS_VALUES[action] * multiplier;
    const now = new Date();

    // Reset monthly points if it's a new month
    const isNewMonth = this.isNewMonth(now);
    const newMonthly = isNewMonth ? pointsToAdd : this.monthly + pointsToAdd;

    return new AudiencePoints({
      total: this.total + pointsToAdd,
      monthly: newMonthly,
      lastUpdated: now,
    });
  }

  addTipPoints(tipAmountInReais: number): AudiencePoints {
    const pointsToAdd = Math.floor(
      tipAmountInReais * AudiencePoints.POINTS_VALUES.send_tip,
    );
    const now = new Date();

    const isNewMonth = this.isNewMonth(now);
    const newMonthly = isNewMonth ? pointsToAdd : this.monthly + pointsToAdd;

    return new AudiencePoints({
      total: this.total + pointsToAdd,
      monthly: newMonthly,
      lastUpdated: now,
    });
  }

  resetMonthlyPoints(): AudiencePoints {
    return new AudiencePoints({
      total: this.total,
      monthly: 0,
      lastUpdated: new Date(),
    });
  }

  getPointsForAction(action: PointsAction): number {
    return AudiencePoints.POINTS_VALUES[action];
  }

  canEarnPoints(action: PointsAction): boolean {
    // Algumas ações podem ter limites diários/mensais
    switch (action) {
      case "scan_qr_code":
        // Máximo 5 scans por dia por músico
        return true; // Implementar lógica de limite se necessário
      case "share_social":
        // Máximo 3 compartilhamentos por dia
        return true; // Implementar lógica de limite se necessário
      default:
        return true;
    }
  }

  getLevel(): number {
    if (this.total >= 2000) return 6;
    if (this.total >= 1000) return 5;
    if (this.total >= 600) return 4;
    if (this.total >= 300) return 3;
    if (this.total >= 100) return 2;
    return 1;
  }

  getPointsToNextLevel(): number {
    const currentLevel = this.getLevel();
    const nextLevelThresholds = [100, 300, 600, 1000, 2000];

    if (currentLevel >= 6) return 0;

    return nextLevelThresholds[currentLevel - 1] - this.total;
  }

  getProgressToNextLevel(): number {
    const currentLevel = this.getLevel();
    const levelThresholds = [0, 100, 300, 600, 1000, 2000];

    if (currentLevel >= 6) return 100;

    const currentThreshold = levelThresholds[currentLevel - 1];
    const nextThreshold = levelThresholds[currentLevel];
    const progress =
      ((this.total - currentThreshold) / (nextThreshold - currentThreshold)) *
      100;

    return Math.min(100, Math.max(0, progress));
  }

  isNewMonth(date: Date): boolean {
    return (
      date.getMonth() !== this.lastUpdated.getMonth() ||
      date.getFullYear() !== this.lastUpdated.getFullYear()
    );
  }

  private validate(): void {
    if (this.total < 0) {
      throw new Error("Total points cannot be negative");
    }
    if (this.monthly < 0) {
      throw new Error("Monthly points cannot be negative");
    }
    if (!this.lastUpdated) {
      throw new Error("Last updated date is required");
    }
    if (this.lastUpdated > new Date()) {
      throw new Error("Last updated date cannot be in the future");
    }
  }

  equals(other: AudiencePoints): boolean {
    return (
      this.total === other.total &&
      this.monthly === other.monthly &&
      this.lastUpdated.getTime() === other.lastUpdated.getTime()
    );
  }

  toJSON() {
    return {
      total: this.total,
      monthly: this.monthly,
      lastUpdated: this.lastUpdated.toISOString(),
      level: this.getLevel(),
      pointsToNextLevel: this.getPointsToNextLevel(),
      progressToNextLevel: this.getProgressToNextLevel(),
    };
  }
}
