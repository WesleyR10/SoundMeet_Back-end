import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { FollowOutput } from "../../core/follow/application/use-cases/common/follow-output";
import { GetFollowSummaryOutput } from "../../core/follow/application/use-cases/get-follow-summary/get-follow-summary.use-case";
import { ListMyFollowsOutput } from "../../core/follow/application/use-cases/list-my-follows/list-my-follows.use-case";
import { FOLLOW_TARGET_TYPES } from "../../core/follow/domain/follow-types";

class FollowTargetSummaryPresenter {
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) avatar: string | null;
}

export class FollowPresenter {
  @ApiProperty({ format: "uuid" }) id: string;
  @ApiProperty({ enum: FOLLOW_TARGET_TYPES }) target_type: string;
  @ApiProperty({ format: "uuid" }) target_id: string;
  @ApiProperty() notifications_enabled: boolean;
  @ApiProperty() created_at: Date;

  @ApiPropertyOptional({
    type: FollowTargetSummaryPresenter,
    nullable: true,
    description:
      "Nome e foto do alvo (só na listagem). `null` quando ele não está mais visível.",
  })
  target?: FollowTargetSummaryPresenter | null;

  constructor(output: FollowOutput) {
    this.id = output.id;
    this.target_type = output.target_type;
    this.target_id = output.target_id;
    this.notifications_enabled = output.notifications_enabled;
    this.created_at = output.created_at;
    if (output.target !== undefined) this.target = output.target;
  }
}

export class FollowCollectionPresenter {
  @ApiProperty({ type: [FollowPresenter] }) data: FollowPresenter[];
  @ApiProperty() meta: {
    total: number;
    current_page: number;
    per_page: number;
    last_page: number;
  };

  constructor(output: ListMyFollowsOutput) {
    this.data = output.items.map((i) => new FollowPresenter(i));
    this.meta = {
      total: output.total,
      current_page: output.current_page,
      per_page: output.per_page,
      last_page: output.last_page,
    };
  }
}

/** Contador + estado do botão. A lista de seguidores nunca sai. */
export class FollowSummaryPresenter {
  @ApiProperty({ enum: FOLLOW_TARGET_TYPES }) target_type: string;
  @ApiProperty({ format: "uuid" }) target_id: string;
  @ApiProperty() followers_count: number;
  @ApiProperty() is_following: boolean;
  @ApiProperty({ format: "uuid", nullable: true }) follow_id: string | null;
  @ApiProperty({ nullable: true }) notifications_enabled: boolean | null;

  constructor(output: GetFollowSummaryOutput) {
    this.target_type = output.target_type;
    this.target_id = output.target_id;
    this.followers_count = output.followers_count;
    this.is_following = output.is_following;
    this.follow_id = output.follow_id;
    this.notifications_enabled = output.notifications_enabled;
  }
}
