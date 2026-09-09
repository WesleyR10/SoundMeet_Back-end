import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database-module/database.module";
import { PlansModule } from "../plans-module/plans.module";
import { CampaignController } from "./campaign.controller";
import { CAMPAIGN_PROVIDERS } from "./campaign.providers";

@Module({
  imports: [DatabaseModule, PlansModule],
  controllers: [CampaignController],
  providers: [
    ...Object.values(CAMPAIGN_PROVIDERS.REPOSITORIES),
    ...Object.values(CAMPAIGN_PROVIDERS.USE_CASES),
  ],
})
export class CampaignModule {}
