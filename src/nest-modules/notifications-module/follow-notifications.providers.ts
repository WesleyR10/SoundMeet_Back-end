import { PrismaClient } from "@prisma/client";

import { NotifyFollowersUseCase } from "../../core/follow/application/use-cases/notify-followers/notify-followers.use-case";
import { IFollowRepository } from "../../core/follow/domain/follow.repository";
import { IFollowPushSender } from "../../core/follow/domain/ports";
import {
  AudiencePushTokenPrisma,
  FollowNotificationLedgerPrisma,
} from "../../core/follow/infra/notifications";
import { PrismaService } from "../database-module/prisma/prisma.service";
import { PushNotificationService } from "./push-notification.service";

/**
 * O disparo para seguidores mora AQUI (nó-folha) e não no `follows-module`:
 * quem envia push é o `PushNotificationService`, e o `follows-module` importar
 * notificações inverteria a direção que mantém este módulo como folha.
 */
export const FOLLOW_NOTIFICATION_PROVIDERS = {
  FOLLOW_PUSH_SENDER: {
    provide: "FollowPushSender",
    useFactory: (push: PushNotificationService): IFollowPushSender => ({
      sendMany: (messages) => push.sendMany(messages),
    }),
    inject: [PushNotificationService],
  },
  NOTIFY_FOLLOWERS_USE_CASE: {
    provide: NotifyFollowersUseCase,
    useFactory: (
      followRepo: IFollowRepository,
      prisma: PrismaClient,
      sender: IFollowPushSender,
    ) =>
      new NotifyFollowersUseCase(
        followRepo,
        new FollowNotificationLedgerPrisma(prisma),
        new AudiencePushTokenPrisma(prisma),
        sender,
      ),
    inject: ["FollowRepository", PrismaService, "FollowPushSender"],
  },
};
