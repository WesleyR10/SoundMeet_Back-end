import { OmitType } from "@nestjs/swagger";

import { SetWeeklyRulesInput } from "../../../core/scheduling/application/use-cases/set-weekly-rules/set-weekly-rules.input";

export class SetWeeklyRulesDto extends OmitType(SetWeeklyRulesInput, [
  "musician_id",
] as const) {}
