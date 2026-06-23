import { Transform } from "class-transformer";

import { BadgeOutput } from "../../core/gamification/application/use-cases/common/badge-output";
import { RankingOutput } from "../../core/gamification/application/use-cases/common/ranking-output";
import { UserBadgeOutput } from "../../core/gamification/application/use-cases/common/user-badge-output";
import { UserPointsOutput } from "../../core/gamification/application/use-cases/common/user-points-output";
import { ListBadgesOutput } from "../../core/gamification/application/use-cases/list-badges/list-badges.use-case";
import { ListRankingsOutput } from "../../core/gamification/application/use-cases/list-rankings/list-rankings.use-case";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class BadgePresenter {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement: Record<string, any>;
  points: number;
  rarity: string;
  is_active: boolean;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: BadgeOutput) {
    this.id = output.id;
    this.name = output.name;
    this.description = output.description;
    this.icon = output.icon;
    this.category = output.category;
    this.requirement = output.requirement;
    this.points = output.points;
    this.rarity = output.rarity;
    this.is_active = output.is_active;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class BadgeCollectionPresenter extends CollectionPresenter {
  data: BadgePresenter[];

  constructor(output: ListBadgesOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new BadgePresenter(i));
  }
}

export class UserPointsPresenter {
  id: string;
  user_id: string;
  total_points: number;
  total_scans: number;
  total_requests: number;
  total_tips: number;
  total_social_shares: number;
  current_level: number;
  level_info: {
    level: number;
    name: string;
    min_points: number;
    max_points: number;
    benefits: string[];
  };
  progress_to_next_level: number;
  is_top_fan: boolean;
  is_active_supporter: boolean;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: UserPointsOutput) {
    this.id = output.id;
    this.user_id = output.user_id;
    this.total_points = output.total_points;
    this.total_scans = output.total_scans;
    this.total_requests = output.total_requests;
    this.total_tips = output.total_tips;
    this.total_social_shares = output.total_social_shares;
    this.current_level = output.current_level;
    this.level_info = output.level_info;
    this.progress_to_next_level = output.progress_to_next_level;
    this.is_top_fan = output.is_top_fan;
    this.is_active_supporter = output.is_active_supporter;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class UserBadgePresenter {
  id: string;
  user_id: string;
  badge_type: string;
  progress: number;
  is_unlocked: boolean;
  @Transform(({ value }: { value: Date | null }) =>
    value ? value.toISOString() : null,
  )
  unlocked_at: Date | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;
  progress_percentage: number;
  remaining_points: number;
  badge_description: string;

  constructor(output: UserBadgeOutput) {
    this.id = output.id;
    this.user_id = output.user_id;
    this.badge_type = output.badge_type;
    this.progress = output.progress;
    this.is_unlocked = output.is_unlocked;
    this.unlocked_at = output.unlocked_at;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
    this.progress_percentage = output.progress_percentage;
    this.remaining_points = output.remaining_points;
    this.badge_description = output.badge_description;
  }
}

export class RankingPresenter {
  id: string;
  user_id: string;
  ranking_type: string;
  period: string;
  position: number;
  score: number;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  period_start: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  period_end: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;
  is_current_period: boolean;
  is_top_position: boolean;
  position_medal: string | null;
  ranking_description: string;
  period_description: string;

  constructor(output: RankingOutput) {
    this.id = output.id;
    this.user_id = output.user_id;
    this.ranking_type = output.ranking_type;
    this.period = output.period;
    this.position = output.position;
    this.score = output.score;
    this.period_start = output.period_start;
    this.period_end = output.period_end;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
    this.is_current_period = output.is_current_period;
    this.is_top_position = output.is_top_position;
    this.position_medal = output.position_medal;
    this.ranking_description = output.ranking_description;
    this.period_description = output.period_description;
  }
}

export class RankingCollectionPresenter extends CollectionPresenter {
  data: RankingPresenter[];

  constructor(output: ListRankingsOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new RankingPresenter(i));
  }
}
