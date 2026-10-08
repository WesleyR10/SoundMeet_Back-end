import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

import {
  FOLLOW_TARGET_TYPES,
  FollowTargetType,
} from "../../../core/follow/domain/follow-types";

/**
 * ⚠️ `audience_id` NÃO entra aqui: vem do path, conferido pelo
 * `AudienceOwnershipGuard`. Por query, daria para listar quem outro fã segue.
 */
export class ListFollowsDto {
  @ApiPropertyOptional({ enum: FOLLOW_TARGET_TYPES })
  @IsIn(FOLLOW_TARGET_TYPES as unknown as string[])
  @IsOptional()
  target_type?: FollowTargetType;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Min(1)
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 15 })
  @Max(50)
  @Min(1)
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  per_page?: number;
}
