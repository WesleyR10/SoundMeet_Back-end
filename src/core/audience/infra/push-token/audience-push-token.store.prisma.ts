import { PrismaClient } from "@prisma/client";

import { IAudiencePushTokenStore } from "../../domain/ports/audience-push-token.store";

export class AudiencePushTokenStorePrisma implements IAudiencePushTokenStore {
  constructor(private readonly prisma: PrismaClient) {}

  async save(params: {
    audience_id: string;
    push_token: string;
    platform: "ios" | "android";
  }): Promise<boolean> {
    const { count } = await this.prisma.audience.updateMany({
      where: { id: params.audience_id },
      data: {
        push_token: params.push_token,
        push_token_platform: params.platform,
      },
    });
    return count > 0;
  }
}
