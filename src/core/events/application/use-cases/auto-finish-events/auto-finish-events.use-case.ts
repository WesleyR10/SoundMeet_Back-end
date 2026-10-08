import { IEventRepository } from "@core/events/domain";

import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";

export type AutoFinishEventsInput = Record<string, never>;

export type AutoFinishEventsOutput = {
  finished: number;
};

/**
 * Finaliza eventos cujo horário de término já passou (Bloco 9.4b).
 *
 * Sem isto, um evento de ontem continua `active` para sempre se o
 * estabelecimento esquecer de finalizar — e "ativo" alimenta a busca pública,
 * o atalho `events/active` do QR code e a elegibilidade de avaliação. Um dado
 * que só é correto quando alguém lembra de clicar não é um dado confiável.
 *
 * Espelha `ExpirePendingBookingsUseCase`, inclusive no clock injetável.
 */
export class AutoFinishEventsUseCase implements IUseCase<
  AutoFinishEventsInput,
  AutoFinishEventsOutput
> {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly clock: IClock = { now: () => new Date() },
  ) {}

  async execute(
    _input: AutoFinishEventsInput = {},
  ): Promise<AutoFinishEventsOutput> {
    const now = this.clock.now();
    const pending = await this.eventRepo.findActiveEndedBefore(now);

    let finished = 0;

    for (const event of pending) {
      event.finish(now);

      // `finish()` recusa evento cancelado por notification em vez de lançar.
      // Um item inválido não pode abortar o lote inteiro — o job roda sem
      // ninguém olhando, e parar no primeiro problema deixaria a fila parada.
      if (event.notification.hasErrors()) {
        continue;
      }

      await this.eventRepo.update(event);
      finished += 1;
    }

    return { finished };
  }
}
