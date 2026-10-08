import { IAudiencePushTokenStore } from "../../domain/ports/audience-push-token.store";

export class AudiencePushTokenStoreInMemory implements IAudiencePushTokenStore {
  readonly tokens = new Map<string, { push_token: string; platform: string }>();

  constructor(private readonly knownAudienceIds: Set<string> = new Set()) {}

  async save(params: {
    audience_id: string;
    push_token: string;
    platform: "ios" | "android";
  }): Promise<boolean> {
    if (!this.knownAudienceIds.has(params.audience_id)) return false;
    this.tokens.set(params.audience_id, {
      push_token: params.push_token,
      platform: params.platform,
    });
    return true;
  }
}
