import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsUUID } from "class-validator";

import {
  FOLLOW_TARGET_TYPES,
  FollowTargetType,
} from "../../../core/follow/domain/follow-types";

export class FollowTargetDto {
  @ApiProperty({ enum: FOLLOW_TARGET_TYPES })
  @IsIn(FOLLOW_TARGET_TYPES as unknown as string[])
  target_type: FollowTargetType;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  target_id: string;
}
