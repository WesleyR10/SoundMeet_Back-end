import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IFollowRepository } from "../../../domain/follow.repository";
import {
  FollowNotificationKind,
  FollowTarget,
} from "../../../domain/follow-types";
import {
  IAudiencePushTokenPort,
  IFollowNotificationLedger,
  IFollowPushSender,
} from "../../../domain/ports";

export type NotifyFollowersInput = {
  kind: FollowNotificationKind;
  event_id: string;
  /**
   * Quem é avisado: seguidores destes alvos — ou, com `previously_notified`,
   * quem já recebeu algum destes avisos sobre o evento (cancelamento: avisa
   * quem soube do show, não todo seguidor).
   */
  recipients:
    | { targets: FollowTarget[] }
    | { previously_notified: FollowNotificationKind[] };
  message: { title: string; body: string; data: Record<string, unknown> };
};

export type NotifyFollowersOutput = { claimed: number; sent: number };

export const NOTIFY_FOLLOWERS_BATCH_SIZE = 500;

/**
 * Avisa seguidores de um show, em lotes.
 *
 * Por lote: quem ainda não foi avisado deste `kind` neste evento é reservado
 * no ledger (`claim`), os tokens de push são lidos e o envio sai. Reservar
 * ANTES de enviar troca "duplicar push" por "perder um push numa queda entre
 * os dois passos" — a segunda é a falha aceitável.
 */
export class NotifyFollowersUseCase implements IUseCase<
  NotifyFollowersInput,
  NotifyFollowersOutput
> {
  constructor(
    private readonly followRepo: IFollowRepository,
    private readonly ledger: IFollowNotificationLedger,
    private readonly pushTokens: IAudiencePushTokenPort,
    private readonly sender: IFollowPushSender,
    private readonly batchSize: number = NOTIFY_FOLLOWERS_BATCH_SIZE,
  ) {}

  async execute(input: NotifyFollowersInput): Promise<NotifyFollowersOutput> {
    let claimed = 0;
    let sent = 0;

    for await (const batch of this.recipientBatches(input)) {
      const fresh = await this.ledger.claim({
        kind: input.kind,
        event_id: input.event_id,
        audience_ids: batch,
        at: new Date(),
      });
      claimed += fresh.length;
      if (!fresh.length) continue;

      const tokens = await this.pushTokens.findPushTokens(fresh);
      if (!tokens.length) continue;

      await this.sender.sendMany(
        tokens.map((t) => ({
          to: t.push_token,
          title: input.message.title,
          body: input.message.body,
          data: input.message.data,
        })),
      );
      sent += tokens.length;
    }

    return { claimed, sent };
  }

  private async *recipientBatches(
    input: NotifyFollowersInput,
  ): AsyncGenerator<string[]> {
    if ("previously_notified" in input.recipients) {
      const ids = await this.ledger.findNotifiedAudienceIds({
        event_id: input.event_id,
        kinds: input.recipients.previously_notified,
      });
      for (let i = 0; i < ids.length; i += this.batchSize) {
        yield ids.slice(i, i + this.batchSize);
      }
      return;
    }

    const { targets } = input.recipients;
    if (!targets.length) return;

    let after: string | null = null;
    for (;;) {
      const ids = await this.followRepo.listNotifiableFollowerIds({
        targets,
        after,
        limit: this.batchSize,
      });
      if (!ids.length) return;
      yield ids;
      if (ids.length < this.batchSize) return;
      after = ids[ids.length - 1];
    }
  }
}
