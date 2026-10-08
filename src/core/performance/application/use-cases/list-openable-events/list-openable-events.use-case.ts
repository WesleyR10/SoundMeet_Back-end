import { EventId } from "../../../../events/domain/event.aggregate";
import { IEventRepository } from "../../../../events/domain/event.repository";
import {
  EventMusicianSearchParams,
  IEventMusicianRepository,
} from "../../../../events/domain/event-musician.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IPerformanceRepository } from "../../../domain/performance.repository";

/**
 * Janela em torno de agora. Generosa de propósito nos dois lados: o músico
 * chega antes e o show atrasa.
 */
const WINDOW_BEFORE_MS = 6 * 60 * 60 * 1000;
const WINDOW_AFTER_MS = 6 * 60 * 60 * 1000;

const ESCALATIONS_PAGE_SIZE = 100;

export type ListOpenableEventsInput = {
  musician_id: string;
  /** Claims `band_ids` do token — um evento pode estar no nome da banda. */
  band_ids?: string[];
  now?: Date;
};

export type OpenableEventOutput = {
  event_id: string;
  establishment_id: string;
  name: string;
  start_at: Date;
  end_at: Date;
  status: string;
  band_id: string | null;
  /** Set já aberto neste evento — o app reabre em vez de oferecer "iniciar". */
  live_performance_id: string | null;
};

export type ListOpenableEventsOutput = {
  events: OpenableEventOutput[];
};

/**
 * Em qual evento o músico pode abrir um set agora.
 *
 * ## Por que mora aqui e não em `events`
 *
 * `EventFilter` não tem `musician_id`, e adicioná-lo obrigaria a mexer no
 * filtro, nos dois repositórios e nos testes de search do domínio `events` —
 * refatoração fora da tarefa. Este caso de uso responde a pergunta usando só o
 * que `EventModule` já exporta: `EventMusician.search` por músico e
 * `Event.findById`.
 *
 * ## A janela de tempo é o filtro que importa
 *
 * Sem ela a lista traria o ano inteiro de agenda, e o músico escolheria o
 * evento errado no escuro do palco — gravando o show na casa errada, que é
 * justamente o eixo por onde F4 e F5 agregam.
 */
export class ListOpenableEventsUseCase implements IUseCase<
  ListOpenableEventsInput,
  ListOpenableEventsOutput
> {
  constructor(
    private readonly eventMusicianRepo: IEventMusicianRepository,
    private readonly eventRepo: IEventRepository,
    private readonly performanceRepo: IPerformanceRepository,
  ) {}

  async execute(
    input: ListOpenableEventsInput,
  ): Promise<ListOpenableEventsOutput> {
    const now = input.now ?? new Date();
    const from = new Date(now.getTime() - WINDOW_BEFORE_MS);
    const to = new Date(now.getTime() + WINDOW_AFTER_MS);

    const escalations = await this.findEscalations(input);

    const events = await Promise.all(
      escalations.map(
        async (escalation): Promise<OpenableEventOutput | null> => {
          const event = await this.eventRepo.findById(
            new EventId(escalation.event_id.id),
          );
          if (!event) return null;

          // Mesma regra do `PerformanceEligibilityService`: encerrado ou
          // cancelado não recebe set novo. Repetida aqui para não OFERECER o que
          // a escrita vai recusar — botão que falha ao ser tocado é pior que
          // botão ausente.
          if (event.status === "cancelled" || event.status === "completed") {
            return null;
          }

          if (event.start_at > to || event.end_at < from) return null;

          const live = await this.performanceRepo.findLiveByEventAndMusician({
            event_id: event.event_id.id,
            musician_id: input.musician_id,
          });

          return {
            event_id: event.event_id.id,
            establishment_id: event.establishment_id.id,
            name: event.name,
            start_at: event.start_at,
            end_at: event.end_at,
            status: event.status,
            band_id: escalation.band_id?.id ?? null,
            live_performance_id: live?.performance_id.id ?? null,
          };
        },
      ),
    );

    return {
      events: events
        .filter((e): e is OpenableEventOutput => e !== null)
        .sort((a, b) => a.start_at.getTime() - b.start_at.getTime()),
    };
  }

  private async findEscalations(input: ListOpenableEventsInput) {
    const searches = [
      this.eventMusicianRepo.search(
        EventMusicianSearchParams.create({
          page: 1,
          per_page: ESCALATIONS_PAGE_SIZE,
          filter: { musician_id: input.musician_id },
        }),
      ),
      // Um evento pode estar no nome da banda, e aí não há `musician_id` na
      // escalação. Sem esta segunda busca, quem toca em banda nunca conseguiria
      // abrir um set.
      ...(input.band_ids ?? []).map((band_id) =>
        this.eventMusicianRepo.search(
          EventMusicianSearchParams.create({
            page: 1,
            per_page: ESCALATIONS_PAGE_SIZE,
            filter: { band_id },
          }),
        ),
      ),
    ];

    const results = await Promise.all(searches);
    const all = results.flatMap((r) => r.items);

    // Escalado como músico E pela banda no mesmo evento renderia duas linhas
    // idênticas na tela de escolha.
    const seen = new Set<string>();
    return all.filter((item) => {
      if (seen.has(item.event_id.id)) return false;
      seen.add(item.event_id.id);
      return true;
    });
  }
}
