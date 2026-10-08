import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";

import { EventSearchParams, IEventRepository } from "../../core/events/domain";
import { EnvConfig } from "../config-module/config.schema";
import { FollowNotificationsHandler } from "./follow-notifications.handler";

/**
 * O job roda às 10h de Brasília, mas "hoje" é o dia de cada CASA — Manaus e o
 * Acre estão 1h e 2h atrás. A busca cobre as próximas 24h (folga para
 * qualquer fuso do país) e o recorte do dia local é do handler, que carrega a
 * casa. Antes o corte era a meia-noite de Brasília, e o show das 23h30 em
 * Manaus (0h30 em Brasília) nunca recebia lembrete: hoje ele caía fora, e no
 * dia seguinte já tinha começado.
 */
const SEARCH_HORIZON_MS = 24 * 60 * 60 * 1000;

/**
 * "Hoje tem show" — às 10h de Brasília, para os eventos públicos que ainda
 * vão começar hoje, no dia da casa.
 *
 * 10h e não de manhã cedo: é aviso de agenda, não alarme. Show que já começou
 * fica de fora (`date_gte: agora`) — para esse, o aviso certo é o "começou
 * agora", que sai do set aberto.
 *
 * ⚠️ **Nada aqui estoura** — exceção num `@Cron` mata o agendador do processo.
 * E a dedupe é do ledger: rodar duas vezes no mesmo dia não reenvia.
 */
@Injectable()
export class FollowRemindersJob {
  private readonly logger = new Logger(FollowRemindersJob.name);

  constructor(
    private readonly configService: ConfigService<EnvConfig>,
    private readonly handler: FollowNotificationsHandler,
    @Inject("EventRepository") private readonly eventRepo: IEventRepository,
  ) {}

  @Cron("0 10 * * *", { timeZone: "America/Sao_Paulo" })
  async handleCron(): Promise<void> {
    if (this.configService.get("NODE_ENV") === "test") return;

    try {
      await this.run(new Date());
    } catch (error) {
      this.logger.error(
        `Lembretes do dia falharam: ${(error as Error).message}`,
      );
    }
  }

  async run(now: Date): Promise<number> {
    let page = 1;
    let reminded = 0;

    for (;;) {
      const result = await this.eventRepo.search(
        EventSearchParams.create({
          filter: {
            is_public: true,
            date_gte: now,
            date_lte: new Date(now.getTime() + SEARCH_HORIZON_MS),
          },
          page,
          per_page: 50,
        }),
      );

      for (const event of result.items) {
        try {
          if (await this.handler.remindToday(event.event_id.id, now)) {
            reminded += 1;
          }
        } catch (error) {
          // Um evento com dado ruim não pode impedir o lembrete dos outros.
          this.logger.error(
            `Lembrete do evento ${event.event_id.id} falhou: ${(error as Error).message}`,
          );
        }
      }

      if (page >= result.last_page) break;
      page += 1;
    }

    return reminded;
  }
}
