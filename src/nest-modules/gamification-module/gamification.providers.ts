import { AddPointsUseCase } from "../../core/gamification/application/use-cases/add-points/add-points.use-case";
import { AwardBadgeUseCase } from "../../core/gamification/application/use-cases/award-badge/award-badge.use-case";
import { CalculatePointsUseCase } from "../../core/gamification/application/use-cases/calculate-points/calculate-points.use-case";
import { CalculateRankingUseCase } from "../../core/gamification/application/use-cases/calculate-ranking/calculate-ranking.use-case";
import { CreateBadgeUseCase } from "../../core/gamification/application/use-cases/create-badge/create-badge.use-case";
import { DeleteBadgeUseCase } from "../../core/gamification/application/use-cases/delete-badge/delete-badge.use-case";
import { GetBadgeUseCase } from "../../core/gamification/application/use-cases/get-badge/get-badge.use-case";
import { GetLeaderboardUseCase } from "../../core/gamification/application/use-cases/get-leaderboard/get-leaderboard.use-case";
import { GetUserBadgesUseCase } from "../../core/gamification/application/use-cases/get-user-badges/get-user-badges.use-case";
import { GetUserPointsUseCase } from "../../core/gamification/application/use-cases/get-user-points/get-user-points.use-case";
import { ListBadgesUseCase } from "../../core/gamification/application/use-cases/list-badges/list-badges.use-case";
import { ListRankingsUseCase } from "../../core/gamification/application/use-cases/list-rankings/list-rankings.use-case";
import { UpdateBadgeUseCase } from "../../core/gamification/application/use-cases/update-badge/update-badge.use-case";
import { IBadgeRepository } from "../../core/gamification/domain/badge.repository";
import { IRankingRepository } from "../../core/gamification/domain/ranking.repository";
import { IUserBadgeRepository } from "../../core/gamification/domain/user-badge.repository";
import { IUserPointsRepository } from "../../core/gamification/domain/user-points.repository";
import { IUserScoreRepository } from "../../core/gamification/domain/user-score.repository";
import { BadgePrismaRepository } from "../../core/gamification/infra/db/prisma/badge-prisma.repository";
import { RankingPrismaRepository } from "../../core/gamification/infra/db/prisma/ranking-prisma.repository";
import { UserBadgePrismaRepository } from "../../core/gamification/infra/db/prisma/user-badge-prisma.repository";
import { UserPointsPrismaRepository } from "../../core/gamification/infra/db/prisma/user-points-prisma.repository";
import { UserScorePrismaRepository } from "../../core/gamification/infra/db/prisma/user-score-prisma.repository";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const REPOSITORIES = {
  BADGE_REPOSITORY: {
    provide: "BadgeRepository",
    useExisting: BadgePrismaRepository,
  },
  BADGE_PRISMA_REPOSITORY: {
    provide: BadgePrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new BadgePrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  USER_POINTS_REPOSITORY: {
    provide: "UserPointsRepository",
    useExisting: UserPointsPrismaRepository,
  },
  USER_POINTS_PRISMA_REPOSITORY: {
    provide: UserPointsPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new UserPointsPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  USER_SCORE_REPOSITORY: {
    provide: "UserScoreRepository",
    useExisting: UserScorePrismaRepository,
  },
  USER_SCORE_PRISMA_REPOSITORY: {
    provide: UserScorePrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new UserScorePrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  USER_BADGE_REPOSITORY: {
    provide: "UserBadgeRepository",
    useExisting: UserBadgePrismaRepository,
  },
  USER_BADGE_PRISMA_REPOSITORY: {
    provide: UserBadgePrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new UserBadgePrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  RANKING_REPOSITORY: {
    provide: "RankingRepository",
    useExisting: RankingPrismaRepository,
  },
  RANKING_PRISMA_REPOSITORY: {
    provide: RankingPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new RankingPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const USE_CASES = {
  ADD_POINTS_USE_CASE: {
    provide: AddPointsUseCase,
    useFactory: (
      userPointsRepo: IUserPointsRepository,
      userScoreRepo: IUserScoreRepository,
    ) => {
      return new AddPointsUseCase(userPointsRepo, userScoreRepo);
    },
    inject: [
      REPOSITORIES.USER_POINTS_REPOSITORY.provide,
      REPOSITORIES.USER_SCORE_REPOSITORY.provide,
    ],
  },
  CALCULATE_POINTS_USE_CASE: {
    provide: CalculatePointsUseCase,
    useFactory: (
      userPointsRepo: IUserPointsRepository,
      userScoreRepo: IUserScoreRepository,
    ) => {
      return new CalculatePointsUseCase(userPointsRepo, userScoreRepo);
    },
    inject: [
      REPOSITORIES.USER_POINTS_REPOSITORY.provide,
      REPOSITORIES.USER_SCORE_REPOSITORY.provide,
    ],
  },
  CALCULATE_RANKING_USE_CASE: {
    provide: CalculateRankingUseCase,
    useFactory: (
      rankingRepo: IRankingRepository,
      userScoreRepo: IUserScoreRepository,
    ) => {
      return new CalculateRankingUseCase(rankingRepo, userScoreRepo);
    },
    inject: [
      REPOSITORIES.RANKING_REPOSITORY.provide,
      REPOSITORIES.USER_SCORE_REPOSITORY.provide,
    ],
  },
  LIST_BADGES_USE_CASE: {
    provide: ListBadgesUseCase,
    useFactory: (badgeRepo: IBadgeRepository) => {
      return new ListBadgesUseCase(badgeRepo);
    },
    inject: [REPOSITORIES.BADGE_REPOSITORY.provide],
  },
  GET_BADGE_USE_CASE: {
    provide: GetBadgeUseCase,
    useFactory: (badgeRepo: IBadgeRepository) => {
      return new GetBadgeUseCase(badgeRepo);
    },
    inject: [REPOSITORIES.BADGE_REPOSITORY.provide],
  },
  GET_LEADERBOARD_USE_CASE: {
    provide: GetLeaderboardUseCase,
    useFactory: (userPointsRepo: IUserPointsRepository) => {
      return new GetLeaderboardUseCase(userPointsRepo);
    },
    inject: [REPOSITORIES.USER_POINTS_REPOSITORY.provide],
  },
  GET_USER_POINTS_USE_CASE: {
    provide: GetUserPointsUseCase,
    useFactory: (userPointsRepo: IUserPointsRepository) => {
      return new GetUserPointsUseCase(userPointsRepo);
    },
    inject: [REPOSITORIES.USER_POINTS_REPOSITORY.provide],
  },
  GET_USER_BADGES_USE_CASE: {
    provide: GetUserBadgesUseCase,
    useFactory: (userBadgeRepo: IUserBadgeRepository) => {
      return new GetUserBadgesUseCase(userBadgeRepo);
    },
    inject: [REPOSITORIES.USER_BADGE_REPOSITORY.provide],
  },
  LIST_RANKINGS_USE_CASE: {
    provide: ListRankingsUseCase,
    useFactory: (rankingRepo: IRankingRepository) => {
      return new ListRankingsUseCase(rankingRepo);
    },
    inject: [REPOSITORIES.RANKING_REPOSITORY.provide],
  },
  CREATE_BADGE_USE_CASE: {
    provide: CreateBadgeUseCase,
    useFactory: (badgeRepo: IBadgeRepository) => {
      return new CreateBadgeUseCase(badgeRepo);
    },
    inject: [REPOSITORIES.BADGE_REPOSITORY.provide],
  },
  UPDATE_BADGE_USE_CASE: {
    provide: UpdateBadgeUseCase,
    useFactory: (badgeRepo: IBadgeRepository) => {
      return new UpdateBadgeUseCase(badgeRepo);
    },
    inject: [REPOSITORIES.BADGE_REPOSITORY.provide],
  },
  DELETE_BADGE_USE_CASE: {
    provide: DeleteBadgeUseCase,
    useFactory: (badgeRepo: IBadgeRepository) => {
      return new DeleteBadgeUseCase(badgeRepo);
    },
    inject: [REPOSITORIES.BADGE_REPOSITORY.provide],
  },
  AWARD_BADGE_USE_CASE: {
    provide: AwardBadgeUseCase,
    useFactory: (userBadgeRepo: IUserBadgeRepository) => {
      return new AwardBadgeUseCase(userBadgeRepo);
    },
    inject: [REPOSITORIES.USER_BADGE_REPOSITORY.provide],
  },
};

export const GAMIFICATION_PROVIDERS = {
  REPOSITORIES,
  USE_CASES,
};
