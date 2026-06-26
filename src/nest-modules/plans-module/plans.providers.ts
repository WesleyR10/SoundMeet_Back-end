import { PlanCheckService } from "../../core/plans";
import { SubscriptionPrismaRepository } from "../../core/plans/infra/db/prisma/subscription-prisma.repository";
import { ISubscriptionRepository } from "../../core/plans/domain/subscription.repository";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const PLAN_PROVIDERS = {
  REPOSITORIES: {
    SUBSCRIPTION_REPOSITORY: {
      provide: "SubscriptionRepository",
      useFactory: (prismaService: PrismaService) =>
        new SubscriptionPrismaRepository(prismaService),
      inject: [PrismaService],
    },
  },
  SERVICES: {
    PLAN_CHECK_SERVICE: {
      provide: PlanCheckService,
      useFactory: (subscriptionRepo: ISubscriptionRepository) =>
        new PlanCheckService(subscriptionRepo),
      inject: ["SubscriptionRepository"],
    },
  },
};
