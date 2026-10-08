import { PrismaClient } from "@prisma/client";

import { IEstablishmentRepository } from "../../core/establishment/domain/establishment.repository";
import { FollowTargetReader } from "../../core/follow/application/use-cases/common/follow-target-reader";
import { FollowTargetUseCase } from "../../core/follow/application/use-cases/follow-target/follow-target.use-case";
import { GetFollowSummaryUseCase } from "../../core/follow/application/use-cases/get-follow-summary/get-follow-summary.use-case";
import { ListMyFollowsUseCase } from "../../core/follow/application/use-cases/list-my-follows/list-my-follows.use-case";
import { ToggleFollowNotificationsUseCase } from "../../core/follow/application/use-cases/toggle-follow-notifications/toggle-follow-notifications.use-case";
import { UnfollowTargetUseCase } from "../../core/follow/application/use-cases/unfollow-target/unfollow-target.use-case";
import { IFollowRepository } from "../../core/follow/domain/follow.repository";
import { FollowPrismaRepository } from "../../core/follow/infra/db/prisma/follow-prisma.repository";
import { IMusicianRepository } from "../../core/musician/domain/musician.repository";
import { PrismaService } from "../database-module/prisma/prisma.service";

export const REPOSITORIES = {
  FOLLOW_REPOSITORY: {
    provide: "FollowRepository",
    useFactory: (prisma: PrismaClient) => new FollowPrismaRepository(prisma),
    inject: [PrismaService],
  },
};

export const SERVICES = {
  FOLLOW_TARGET_READER: {
    provide: FollowTargetReader,
    useFactory: (
      musicianRepo: IMusicianRepository,
      establishmentRepo: IEstablishmentRepository,
    ) => new FollowTargetReader(musicianRepo, establishmentRepo),
    inject: ["MusicianRepository", "EstablishmentRepository"],
  },
};

export const USE_CASES = {
  FOLLOW_TARGET_USE_CASE: {
    provide: FollowTargetUseCase,
    useFactory: (repo: IFollowRepository, targets: FollowTargetReader) =>
      new FollowTargetUseCase(repo, targets),
    inject: [REPOSITORIES.FOLLOW_REPOSITORY.provide, FollowTargetReader],
  },
  UNFOLLOW_TARGET_USE_CASE: {
    provide: UnfollowTargetUseCase,
    useFactory: (repo: IFollowRepository) => new UnfollowTargetUseCase(repo),
    inject: [REPOSITORIES.FOLLOW_REPOSITORY.provide],
  },
  LIST_MY_FOLLOWS_USE_CASE: {
    provide: ListMyFollowsUseCase,
    useFactory: (repo: IFollowRepository, targets: FollowTargetReader) =>
      new ListMyFollowsUseCase(repo, targets),
    inject: [REPOSITORIES.FOLLOW_REPOSITORY.provide, FollowTargetReader],
  },
  GET_FOLLOW_SUMMARY_USE_CASE: {
    provide: GetFollowSummaryUseCase,
    useFactory: (repo: IFollowRepository) => new GetFollowSummaryUseCase(repo),
    inject: [REPOSITORIES.FOLLOW_REPOSITORY.provide],
  },
  TOGGLE_FOLLOW_NOTIFICATIONS_USE_CASE: {
    provide: ToggleFollowNotificationsUseCase,
    useFactory: (repo: IFollowRepository) =>
      new ToggleFollowNotificationsUseCase(repo),
    inject: [REPOSITORIES.FOLLOW_REPOSITORY.provide],
  },
};

export const FOLLOW_PROVIDERS = { REPOSITORIES, SERVICES, USE_CASES };
