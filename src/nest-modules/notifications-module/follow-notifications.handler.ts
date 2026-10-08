import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  EstablishmentId,
  IEstablishmentRepository,
} from "../../core/establishment/domain";
import {
  Event,
  EventId,
  EventMusicianSearchParams,
  IEventMusicianRepository,
  IEventRepository,
} from "../../core/events/domain";
import { EventCancelledEvent } from "../../core/events/domain/events/event-cancelled.event";
import { EventCreatedEvent } from "../../core/events/domain/events/event-created.event";
import { EventPerformerConfirmedEvent } from "../../core/events/domain/events/event-performer-confirmed.event";
import {
  NotifyFollowersInput,
  NotifyFollowersUseCase,
} from "../../core/follow/application/use-cases/notify-followers/notify-followers.use-case";
import { FollowTarget } from "../../core/follow/domain/follow-types";
import { IMusicianRepository, MusicianId } from "../../core/musician/domain";
import { PerformanceStartedEvent } from "../../core/performance/domain/events/performance-started.event";
import {
  DEFAULT_BRAZIL_TIMEZONE,
  localDayWindow,
} from "../../core/shared/domain/brazil-timezone";

/**
 * Avisos no celular para quem segue músicos e casas (Bloco 19.B).
 *
 * | aviso            | gatilho                                  | quem recebe                 |
 * |------------------|------------------------------------------|-----------------------------|
 * | show anunciado   | `EventCreatedEvent` (público, futuro)    | seguidores da casa          |
 * | artista confirmado | `EventPerformerConfirmedEvent`         | seguidores do músico        |
 * | começou agora    | `PerformanceStartedEvent` (set aberto)   | seguidores do músico + casa |
 * | lembrete no dia  | `FollowRemindersJob` (10h, Brasília)     | seguidores do músico + casa |
 * | show cancelado   | `EventCancelledEvent`                    | quem soube do show por aqui |
 *
 * 🔴 **Evento privado nunca notifica.** É o mesmo portão do cartaz da Home.
 *
 * ## Por que o trabalho roda solto (`dispatch`)
 *
 * O mediator usa `emitAsync`, que ESPERA os handlers: avisar 20 mil seguidores
 * dentro do `POST` de criar evento seguraria a resposta do estabelecimento pelo
 * tempo do envio. O handler dispara e devolve; falha vira log, nunca erro para
 * quem criou o evento — o aviso é consequência, não parte, da ação.
 */
@Injectable()
export class FollowNotificationsHandler {
  private readonly logger = new Logger(FollowNotificationsHandler.name);
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly notifyFollowers: NotifyFollowersUseCase,
    @Inject("EventRepository") private readonly eventRepo: IEventRepository,
    @Inject("EventMusicianRepository")
    private readonly eventMusicianRepo: IEventMusicianRepository,
    @Inject("MusicianRepository")
    private readonly musicianRepo: IMusicianRepository,
    @Inject("EstablishmentRepository")
    private readonly establishmentRepo: IEstablishmentRepository,
  ) {}

  @OnEvent(EventCreatedEvent.name)
  onEventCreated(event: EventCreatedEvent): void {
    this.dispatch("show_announced", async () => {
      const show = await this.loadNotifiableShow(event.aggregate_id.id);
      if (!show || show.event.start_at.getTime() <= Date.now()) return null;

      return {
        kind: "show_announced",
        event_id: show.event.event_id.id,
        recipients: { targets: [this.venueTarget(show.event)] },
        message: {
          title: `${show.venue} anunciou um show`,
          body: `${show.event.name} · ${formatShowTime(show.event.start_at, show.timezone)}`,
          data: this.data("follow.show_announced", show.event),
        },
      };
    });
  }

  @OnEvent(EventPerformerConfirmedEvent.name)
  onPerformerConfirmed(event: EventPerformerConfirmedEvent): void {
    // Banda não é seguível na v1 — ver `FOLLOW_TARGET_TYPES`.
    if (!event.musician_id) return;
    const musicianId = event.musician_id;

    this.dispatch("artist_confirmed", async () => {
      const show = await this.loadNotifiableShow(event.event_id);
      if (!show || show.event.start_at.getTime() <= Date.now()) return null;
      const artist = await this.artistName(musicianId);
      if (!artist) return null;

      return {
        kind: "artist_confirmed",
        event_id: show.event.event_id.id,
        recipients: {
          targets: [{ target_type: "musician", target_id: musicianId }],
        },
        message: {
          title: `${artist} vai tocar no ${show.venue}`,
          body: `${show.event.name} · ${formatShowTime(show.event.start_at, show.timezone)}`,
          data: {
            ...this.data("follow.artist_confirmed", show.event),
            musician_id: musicianId,
          },
        },
      };
    });
  }

  @OnEvent(PerformanceStartedEvent.name)
  onPerformanceStarted(event: PerformanceStartedEvent): void {
    this.dispatch("started_now", async () => {
      const show = await this.loadNotifiableShow(event.event_id);
      if (!show) return null;
      const artist = await this.artistName(event.musician_id);
      if (!artist) return null;

      return {
        kind: "started_now",
        event_id: show.event.event_id.id,
        recipients: {
          targets: [
            { target_type: "musician", target_id: event.musician_id },
            this.venueTarget(show.event),
          ],
        },
        message: {
          title: `${artist} começou agora`,
          body: `Ao vivo no ${show.venue}. Toque para ver o que está tocando.`,
          data: {
            ...this.data("follow.started_now", show.event),
            musician_id: event.musician_id,
          },
        },
      };
    });
  }

  @OnEvent(EventCancelledEvent.name)
  onEventCancelled(event: EventCancelledEvent): void {
    this.dispatch("show_cancelled", async () => {
      const show = await this.loadShow(event.aggregate_id.id);
      if (!show) return null;

      return {
        kind: "show_cancelled",
        event_id: show.event.event_id.id,
        // Só quem SOUBE do show por aqui — avisar todo seguidor de um
        // cancelamento de algo que ele nunca viu anunciado é ruído.
        recipients: {
          previously_notified: [
            "show_announced",
            "artist_confirmed",
            "day_reminder",
          ],
        },
        message: {
          title: "Show cancelado",
          body: `${show.event.name} no ${show.venue} (${formatShowTime(show.event.start_at, show.timezone)}) foi cancelado.`,
          data: this.data("follow.show_cancelled", show.event),
        },
      };
    });
  }

  /**
   * Lembrete do dia para UM evento. Chamado pelo `FollowRemindersJob`; aqui
   * (e não no job) para que a regra de visibilidade e o texto morem num lugar
   * só.
   *
   * "Hoje" é o dia do calendário no fuso da CASA: o job busca as próximas
   * 24h, e só aqui, com a casa carregada, dá para saber se o show das 23h30
   * de Manaus (0h30 em Brasília) ainda é de hoje. Devolve se lembrou.
   */
  async remindToday(eventId: string, now: Date = new Date()): Promise<boolean> {
    const show = await this.loadNotifiableShow(eventId);
    if (!show) return false;
    const today = localDayWindow(now, show.timezone, 0);
    const startsToday =
      show.event.start_at >= now && show.event.start_at < today.end;
    if (!startsToday) return false;

    const performers = await this.eventMusicianRepo.search(
      EventMusicianSearchParams.create({
        filter: { event_id: eventId, status: "confirmed" },
        per_page: 50,
      }),
    );
    const targets: FollowTarget[] = [
      this.venueTarget(show.event),
      ...performers.items
        .filter((p) => p.musician_id)
        .map((p) => ({
          target_type: "musician" as const,
          target_id: p.musician_id!.id,
        })),
    ];

    await this.notifyFollowers.execute({
      kind: "day_reminder",
      event_id: eventId,
      recipients: { targets },
      message: {
        title: `Hoje tem show no ${show.venue}`,
        body: `${show.event.name} · ${formatShowTime(show.event.start_at, show.timezone)}`,
        data: this.data("follow.day_reminder", show.event),
      },
    });
    return true;
  }

  /** Para testes: espera os envios disparados terminarem. */
  async idle(): Promise<void> {
    await Promise.all([...this.inFlight]);
  }

  private dispatch(
    kind: string,
    build: () => Promise<NotifyFollowersInput | null>,
  ): void {
    const run = (async () => {
      try {
        const input = await build();
        if (!input) return;
        const { claimed, sent } = await this.notifyFollowers.execute(input);
        this.logger.log(
          `follow.${kind}: ${sent} push(es) / ${claimed} reservado(s) — evento ${input.event_id}`,
        );
      } catch (error) {
        this.logger.error(`follow.${kind} falhou: ${(error as Error).message}`);
      }
    })();
    this.inFlight.add(run);
    void run.finally(() => this.inFlight.delete(run));
  }

  private async loadShow(
    eventId: string,
  ): Promise<{ event: Event; venue: string; timezone: string } | null> {
    const event = await this.eventRepo.findById(new EventId(eventId));
    if (!event) return null;
    const venue = await this.establishmentRepo.findById(
      new EstablishmentId(event.establishment_id.id),
    );
    return {
      event,
      venue: venue?.name ?? "um local",
      timezone: venue?.venueTimezone() ?? DEFAULT_BRAZIL_TIMEZONE,
    };
  }

  /** Evento público e ainda de pé. Privado ou encerrado não notifica. */
  private async loadNotifiableShow(eventId: string) {
    const show = await this.loadShow(eventId);
    if (!show) return null;
    if (!show.event.is_public) return null;
    if (show.event.status === "cancelled" || show.event.status === "completed")
      return null;
    return show;
  }

  /** Nome do artista — só se ele ainda é visível (mesma regra de seguir). */
  private async artistName(musicianId: string): Promise<string | null> {
    const musician = await this.musicianRepo.findById(
      new MusicianId(musicianId),
    );
    if (!musician || !musician.is_active || musician.open_to_gigs !== true)
      return null;
    return (musician.stage_name?.trim() || musician.name).trim();
  }

  private venueTarget(event: Event): FollowTarget {
    return {
      target_type: "establishment",
      target_id: event.establishment_id.id,
    };
  }

  private data(type: string, event: Event): Record<string, unknown> {
    return {
      type,
      event_id: event.event_id.id,
      establishment_id: event.establishment_id.id,
    };
  }
}

/**
 * "sáb., 12/10, 21:00" no fuso da CASA. Era sempre Brasília: o show das 21h em
 * Manaus chegava ao fã como 22h, e no Acre como 23h.
 */
export function formatShowTime(
  date: Date,
  timezone: string = DEFAULT_BRAZIL_TIMEZONE,
): string {
  return date.toLocaleString("pt-BR", {
    timeZone: timezone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
