import { Module } from "@nestjs/common";

import { PlanCheckService } from "../../core/plans";
import { DatabaseModule } from "../database-module/database.module";
import { PLAN_PROVIDERS } from "./plans.providers";

@Module({
  imports: [DatabaseModule],
  providers: [
    ...Object.values(PLAN_PROVIDERS.REPOSITORIES),
    ...Object.values(PLAN_PROVIDERS.SERVICES),
  ],
  exports: [PlanCheckService],
})
export class PlansModule {}
