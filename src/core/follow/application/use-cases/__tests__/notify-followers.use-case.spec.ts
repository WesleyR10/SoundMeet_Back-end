import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Follow } from "../../../domain/follow.aggregate";
import {
  FollowPushMessage,
  IAudiencePushTokenPort,
} from "../../../domain/ports";
import { FollowInMemoryRepository } from "../../../infra/db/in-memory/follow-in-memory.repository";
import { FollowNotificationLedgerInMemory } from "../../../infra/notifications/follow-notification-ledger.in-memory";
import { NotifyFollowersUseCase } from "../notify-followers/notify-followers.use-case";

describe("NotifyFollowersUseCase", () => {
  const MUSICIAN = {
    target_type: "musician" as const,
    target_id: new Uuid().id,
  };
  const VENUE = {
    target_type: "establishment" as const,
    target_id: new Uuid().id,
  };
  const EVENT_ID = new Uuid().id;
  const message = { title: "t", body: "b", data: { type: "x" } };

  let followRepo: FollowInMemoryRepository;
  let ledger: FollowNotificationLedgerInMemory;
  let tokens: Map<string, string>;
  let sent: FollowPushMessage[];

  const pushTokens: IAudiencePushTokenPort = {
    findPushTokens: async (ids) =>
      ids
        .filter((id) => tokens.has(id))
        .map((id) => ({ audience_id: id, push_token: tokens.get(id)! })),
  };

  const useCase = (batchSize?: number) =>
    new NotifyFollowersUseCase(
      followRepo,
      ledger,
      pushTokens,
      {
        sendMany: async (m) => {
          sent.push(...m);
        },
      },
      batchSize,
    );

  const fanFollowing = async (
    targets: Array<typeof MUSICIAN | typeof VENUE>,
    opts: { token?: boolean; enabled?: boolean } = {},
  ) => {
    const fan = new Uuid().id;
    for (const t of targets) {
      const follow = Follow.fake()
        .aFollow()
        .withAudienceId(fan)
        .withTarget(t.target_type, t.target_id)
        .withNotificationsEnabled(opts.enabled ?? true)
        .build();
      await followRepo.insert(follow);
    }
    if (opts.token ?? true) tokens.set(fan, `ExponentPushToken[${fan}]`);
    return fan;
  };

  beforeEach(() => {
    followRepo = new FollowInMemoryRepository();
    ledger = new FollowNotificationLedgerInMemory();
    tokens = new Map();
    sent = [];
  });

  it("🔴 quem segue o músico E a casa recebe UM push só", async () => {
    await fanFollowing([MUSICIAN, VENUE]);

    const output = await useCase().execute({
      kind: "started_now",
      event_id: EVENT_ID,
      recipients: { targets: [MUSICIAN, VENUE] },
      message,
    });

    expect(output).toEqual({ claimed: 1, sent: 1 });
    expect(sent).toHaveLength(1);
  });

  it("🔴 reentrar (retry, replay) não reenvia", async () => {
    await fanFollowing([VENUE]);
    const input = {
      kind: "show_announced" as const,
      event_id: EVENT_ID,
      recipients: { targets: [VENUE] },
      message,
    };

    await useCase().execute(input);
    const second = await useCase().execute(input);

    expect(second).toEqual({ claimed: 0, sent: 0 });
    expect(sent).toHaveLength(1);
  });

  it("tipos diferentes do mesmo evento são avisos diferentes", async () => {
    await fanFollowing([VENUE]);

    await useCase().execute({
      kind: "show_announced",
      event_id: EVENT_ID,
      recipients: { targets: [VENUE] },
      message,
    });
    await useCase().execute({
      kind: "day_reminder",
      event_id: EVENT_ID,
      recipients: { targets: [VENUE] },
      message,
    });

    expect(sent).toHaveLength(2);
  });

  it("respeita o aviso desligado no vínculo e ignora quem não tem aparelho", async () => {
    await fanFollowing([VENUE], { enabled: false });
    await fanFollowing([VENUE], { token: false });
    await fanFollowing([VENUE]);

    const output = await useCase().execute({
      kind: "show_announced",
      event_id: EVENT_ID,
      recipients: { targets: [VENUE] },
      message,
    });

    expect(output).toEqual({ claimed: 2, sent: 1 });
  });

  it("anda em lotes pelo cursor sem perder nem repetir ninguém", async () => {
    for (let i = 0; i < 7; i++) await fanFollowing([MUSICIAN]);

    const output = await useCase(3).execute({
      kind: "artist_confirmed",
      event_id: EVENT_ID,
      recipients: { targets: [MUSICIAN] },
      message,
    });

    expect(output.sent).toBe(7);
    expect(new Set(sent.map((m) => m.to)).size).toBe(7);
  });

  it("🔴 sem alvo, ninguém é avisado (nunca 'todos')", async () => {
    await fanFollowing([MUSICIAN]);

    const output = await useCase().execute({
      kind: "show_announced",
      event_id: EVENT_ID,
      recipients: { targets: [] },
      message,
    });

    expect(output.sent).toBe(0);
  });

  it("cancelamento avisa só quem soube do show por aqui", async () => {
    const knew = await fanFollowing([VENUE]);
    await useCase().execute({
      kind: "show_announced",
      event_id: EVENT_ID,
      recipients: { targets: [VENUE] },
      message,
    });
    await fanFollowing([VENUE]); // seguiu depois do anúncio
    sent = [];

    await useCase().execute({
      kind: "show_cancelled",
      event_id: EVENT_ID,
      recipients: {
        previously_notified: [
          "show_announced",
          "artist_confirmed",
          "day_reminder",
        ],
      },
      message,
    });

    expect(sent.map((m) => m.to)).toEqual([`ExponentPushToken[${knew}]`]);
  });
});
