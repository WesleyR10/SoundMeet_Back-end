import { FollowNotificationKind } from "../../domain/follow-types";
import { IFollowNotificationLedger } from "../../domain/ports";

export class FollowNotificationLedgerInMemory implements IFollowNotificationLedger {
  readonly deliveries: Array<{
    audience_id: string;
    kind: FollowNotificationKind;
    event_id: string;
  }> = [];

  async claim(params: {
    kind: FollowNotificationKind;
    event_id: string;
    audience_ids: string[];
  }): Promise<string[]> {
    const claimed: string[] = [];
    for (const audience_id of params.audience_ids) {
      const exists = this.deliveries.some(
        (d) =>
          d.audience_id === audience_id &&
          d.kind === params.kind &&
          d.event_id === params.event_id,
      );
      if (exists) continue;
      this.deliveries.push({
        audience_id,
        kind: params.kind,
        event_id: params.event_id,
      });
      claimed.push(audience_id);
    }
    return claimed;
  }

  async findNotifiedAudienceIds(params: {
    event_id: string;
    kinds: FollowNotificationKind[];
  }): Promise<string[]> {
    const ids = new Set(
      this.deliveries
        .filter(
          (d) =>
            d.event_id === params.event_id && params.kinds.includes(d.kind),
        )
        .map((d) => d.audience_id),
    );
    return [...ids].sort();
  }
}
