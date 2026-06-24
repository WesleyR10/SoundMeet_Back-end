import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
  validateSync,
} from "class-validator";
import { Type } from "class-transformer";

export class WeeklyRuleItem {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "start_time must be in HH:mm format",
  })
  start_time: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "end_time must be in HH:mm format",
  })
  end_time: string;

  @IsBoolean()
  @IsOptional()
  is_available?: boolean;
}

export type SetWeeklyRulesInputConstructorProps = {
  musician_id: string;
  rules: Array<{
    weekday: number;
    start_time: string;
    end_time: string;
    is_available?: boolean;
  }>;
};

export class SetWeeklyRulesInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  musician_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklyRuleItem)
  rules: WeeklyRuleItem[];

  constructor(props: SetWeeklyRulesInputConstructorProps) {
    if (!props) return;
    this.musician_id = props.musician_id;
    this.rules = (props.rules ?? []).map((r) => {
      const item = new WeeklyRuleItem();
      item.weekday = r.weekday;
      item.start_time = r.start_time;
      item.end_time = r.end_time;
      item.is_available = r.is_available;
      return item;
    });
  }
}

export class ValidateSetWeeklyRulesInput {
  static validate(input: SetWeeklyRulesInput) {
    return validateSync(input);
  }
}
