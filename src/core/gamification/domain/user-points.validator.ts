import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsDate,
  IsBoolean,
} from "class-validator";
import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { UserPoints } from "./user-points.aggregate";

export class UserPointsRules {
  @IsNotEmpty({ groups: ["user_id"] })
  @IsString({ groups: ["user_id"] })
  user_id: string;

  @Min(0, { groups: ["total_points"] })
  @IsNumber({}, { groups: ["total_points"] })
  @IsOptional({ groups: ["total_points"] })
  total_points?: number;

  @Min(0, { groups: ["total_scans"] })
  @IsNumber({}, { groups: ["total_scans"] })
  @IsOptional({ groups: ["total_scans"] })
  total_scans?: number;

  @Min(0, { groups: ["total_requests"] })
  @IsNumber({}, { groups: ["total_requests"] })
  @IsOptional({ groups: ["total_requests"] })
  total_requests?: number;

  @Min(0, { groups: ["total_tips"] })
  @IsNumber({}, { groups: ["total_tips"] })
  @IsOptional({ groups: ["total_tips"] })
  total_tips?: number;

  @Min(0, { groups: ["total_social_shares"] })
  @IsNumber({}, { groups: ["total_social_shares"] })
  @IsOptional({ groups: ["total_social_shares"] })
  total_social_shares?: number;

  @Min(1, { groups: ["current_level"] })
  @Max(5, { groups: ["current_level"] })
  @IsNumber({}, { groups: ["current_level"] })
  @IsOptional({ groups: ["current_level"] })
  current_level?: number;

  @IsBoolean({ groups: ["is_active"] })
  @IsOptional({ groups: ["is_active"] })
  is_active?: boolean;

  @IsDate({ groups: ["created_at"] })
  @IsOptional({ groups: ["created_at"] })
  created_at?: Date;

  @IsDate({ groups: ["updated_at"] })
  @IsOptional({ groups: ["updated_at"] })
  updated_at?: Date;

  constructor(entity: UserPoints | any) {
    this.user_id = entity?.user_id?.value || entity?.user_id;
    this.total_points = entity?.total_points;
    this.total_scans = entity?.total_scans;
    this.total_requests = entity?.total_requests;
    this.total_tips = entity?.total_tips;
    this.total_social_shares = entity?.total_social_shares;
    this.current_level = entity?.current_level;
    this.is_active = entity?.is_active;
    this.created_at = entity?.created_at;
    this.updated_at = entity?.updated_at;

    // Convert Uuid objects to strings for validation
    if (
      entity.user_id &&
      typeof entity.user_id === "object" &&
      entity.user_id.id
    ) {
      this.user_id = entity.user_id.id;
    }
  }
}

export class UserPointsValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length ? fields : ["user_id"];
    return super.validate(notification, new UserPointsRules(data), newFields);
  }
}

export class UserPointsValidatorFactory {
  static create(): UserPointsValidator {
    return new UserPointsValidator();
  }
}
