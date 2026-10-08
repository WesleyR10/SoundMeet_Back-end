import { PrismaClient } from "@prisma/client";

import { IAudiencePushTokenPort } from "../../domain/ports";

export class AudiencePushTokenPrisma implements IAudiencePushTokenPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findPushTokens(
    audience_ids: string[],
  ): Promise<Array<{ audience_id: string; push_token: string }>> {
    if (!audience_ids.length) return [];
    const rows = await this.prisma.audience.findMany({
      where: {
        id: { in: audience_ids },
        is_active: true,
        push_token: { not: null },
      },
      select: { id: true, push_token: true },
    });
    return rows.map((r) => ({ audience_id: r.id, push_token: r.push_token! }));
  }
}
