import { CreateCampaignUseCase } from "../../core/campaign/application/use-cases/create-campaign/create-campaign.use-case";
import { DeleteCampaignUseCase } from "../../core/campaign/application/use-cases/delete-campaign/delete-campaign.use-case";
import { GetCampaignUseCase } from "../../core/campaign/application/use-cases/get-campaign/get-campaign.use-case";
import { ListCampaignsUseCase } from "../../core/campaign/application/use-cases/list-campaigns/list-campaigns.use-case";
import { ICampaignRepository } from "../../core/campaign/domain/campaign.repository";
import { CampaignPrismaRepository } from "../../core/campaign/infra/db/prisma/campaign-prisma.repository";
import { PlanCheckService } from "../../core/plans/domain/plan-check.service";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const REPOSITORIES = {
  CAMPAIGN_REPOSITORY: {
    provide: "CampaignRepository",
    useExisting: CampaignPrismaRepository,
  },
  CAMPAIGN_PRISMA_REPOSITORY: {
    provide: CampaignPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new CampaignPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const USE_CASES = {
  CREATE_CAMPAIGN_USE_CASE: {
    provide: CreateCampaignUseCase,
    useFactory: (
      campaignRepo: ICampaignRepository,
      planCheckService: PlanCheckService,
    ) => {
      return new CreateCampaignUseCase(campaignRepo, planCheckService);
    },
    inject: [REPOSITORIES.CAMPAIGN_REPOSITORY.provide, PlanCheckService],
  },
  GET_CAMPAIGN_USE_CASE: {
    provide: GetCampaignUseCase,
    useFactory: (campaignRepo: ICampaignRepository) => {
      return new GetCampaignUseCase(campaignRepo);
    },
    inject: [REPOSITORIES.CAMPAIGN_REPOSITORY.provide],
  },
  LIST_CAMPAIGNS_USE_CASE: {
    provide: ListCampaignsUseCase,
    useFactory: (campaignRepo: ICampaignRepository) => {
      return new ListCampaignsUseCase(campaignRepo);
    },
    inject: [REPOSITORIES.CAMPAIGN_REPOSITORY.provide],
  },
  DELETE_CAMPAIGN_USE_CASE: {
    provide: DeleteCampaignUseCase,
    useFactory: (campaignRepo: ICampaignRepository) => {
      return new DeleteCampaignUseCase(campaignRepo);
    },
    inject: [REPOSITORIES.CAMPAIGN_REPOSITORY.provide],
  },
};

export const CAMPAIGN_PROVIDERS = {
  REPOSITORIES,
  USE_CASES,
};
