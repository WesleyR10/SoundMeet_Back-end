import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

import { FollowNotificationKind } from "../../domain/follow-types";
import { IFollowNotificationLedger } from "../../domain/ports";

/**
 * 🔴 `INSERT … ON CONFLICT DO NOTHING RETURNING` é o que faz a dedupe valer
 * sob concorrência: dois handlers do mesmo evento disputando o mesmo fã, só um
 * recebe a linha de volta e envia. Um "lê quem já foi avisado, insere o resto"
 * deixaria os dois passarem. SQL cru — o in-memory não prova nada sobre ele.
 */
export class FollowNotificationLedgerPrisma implements IFollowNotificationLedger {
  constructor(private readonly prisma: PrismaClient) {}

  async claim(params: {
    kind: FollowNotificationKind;
    event_id: string;
    audience_ids: string[];
    at: Date;
  }): Promise<string[]> {
    if (!params.audience_ids.length) return [];

    const values = Prisma.join(
      params.audience_ids.map(
        (audienceId) =>
          Prisma.sql`(${randomUUID()}, ${audienceId}, ${params.kind}, ${params.event_id}, ${params.at})`,
      ),
    );

    const rows = await this.prisma.$queryRaw<Array<{ audience_id: string }>>`
      INSERT INTO "notification_deliveries" ("id", "audience_id", "kind", "event_id", "sent_at")
      VALUES ${values}
      ON CONFLICT ("audience_id", "kind", "event_id") DO NOTHING
      RETURNING "audience_id"
    `;
    return rows.map((r) => r.audience_id);
  }

  async findNotifiedAudienceIds(params: {
    event_id: string;
    kinds: FollowNotificationKind[];
  }): Promise<string[]> {
    if (!params.kinds.length) return [];
    const rows = await this.prisma.notificationDelivery.findMany({
      where: { event_id: params.event_id, kind: { in: params.kinds } },
      distinct: ["audience_id"],
      orderBy: { audience_id: "asc" },
      select: { audience_id: true },
    });
    return rows.map((r) => r.audience_id);
  }
}
