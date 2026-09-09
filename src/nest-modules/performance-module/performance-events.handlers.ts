import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { SongStartedEvent } from "../../core/performance/domain/events/song-started.event";
import { MarkRequestPlayedInput } from "../../core/request/application/use-cases/mark-request-played/mark-request-played.input";
import { MarkRequestPlayedUseCase } from "../../core/request/application/use-cases/mark-request-played/mark-request-played.use-case";
import { RequestEventProcessingService } from "../requests-module/request-event-processing.service";

/**
 * Efeitos cross-context de uma música iniciada.
 *
 * ## Por que aqui e não dentro do `StartSongUseCase`
 *
 * `RequestPrismaRepository` não participa de `UnitOfWork` (só os repositórios
 * de pagamento participam). Uma escrita inline nos dois agregados **não seria
 * atômica de qualquer forma** — daria a aparência de transação sem a garantia.
 * Pior: falhar o registro da música porque um status secundário não gravou é o
 * pior resultado possível para quem está no palco.
 *
 * Handler com `processOnce` é o padrão que este projeto já usa para exatamente
 * isso (`RequestEventsHandlers`): idempotente por chave, com retry, e a falha
 * vira log em vez de derrubar a ação principal.
 */
@Injectable()
export class PerformanceEventsHandlers {
  private readonly logger = new Logger(PerformanceEventsHandlers.name);

  constructor(
    @Inject(MarkRequestPlayedUseCase)
    private readonly markRequestPlayedUseCase: MarkRequestPlayedUseCase,
    private readonly eventProcessing: RequestEventProcessingService,
  ) {}

  /**
   * Música tocada em atendimento a um pedido marca o pedido como tocado.
   *
   * Sem isto haveria duas verdades sobre "este pedido foi tocado?": o set diria
   * que sim e o pedido continuaria `accepted` — e o relatório pós-show
   * contradiria a si mesmo na mesma tela. De quebra, é o que finalmente aciona
   * `RequestPlayedEvent`, que dá ao fã os pontos de bônus por ter a música
   * atendida (a rota `PATCH /requests/:id/played` existe desde sempre e nunca
   * teve quem a chamasse).
   */
  @OnEvent(SongStartedEvent.name)
  async handleSongStarted(event: SongStartedEvent) {
    if (!event.request_id) return;

    try {
      await this.eventProcessing.processOnce(
        `song_played:${event.performance_id.id}:${event.request_id}`,
        () =>
          this.markRequestPlayedUseCase.execute(
            new MarkRequestPlayedInput({
              request_id: event.request_id!,
              played_at: event.started_at.toISOString(),
              musician_id: event.musician_id,
            }),
          ),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: "performance.song_started",
          performance_id: event.performance_id.id,
          request_id: event.request_id,
          musician_id: event.musician_id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
