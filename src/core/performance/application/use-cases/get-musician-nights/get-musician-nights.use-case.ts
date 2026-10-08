import { EstablishmentId } from "../../../../establishment/domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../../establishment/domain/establishment.repository";
import { IEventAttendeeRepository } from "../../../../events/domain/event-attendee.repository";
import {
  Musician,
  MusicianId,
} from "../../../../musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../../musician/domain/musician.repository";
import { ITipRepository } from "../../../../payment/domain/repositories/tip.repository";
import { Tip } from "../../../../payment/domain/tip.aggregate";
import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { Request } from "../../../../request/domain/request.aggregate";
import { IRequestRepository } from "../../../../request/domain/request.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Performance } from "../../../domain/performance.aggregate";
import { IPerformanceRepository } from "../../../domain/performance.repository";

/** Os períodos da tela — os mesmos três do Analytics do estabelecimento. */
export const NIGHT_PERIOD_DAYS = [7, 30, 90] as const;
export type NightPeriodDays = (typeof NIGHT_PERIOD_DAYS)[number];

const DAY_MS = 86_400_000;

export type GetMusicianNightsInput = {
  musician_id: string;
  days: NightPeriodDays;
  /** Injetável para teste; em produção, o relógio do servidor. */
  now?: Date;
};

/** Uma noite = um EVENTO em que o músico abriu set. */
export type MusicianNightOutput = {
  event_id: string;
  establishment_id: string;
  /** `null` = casa removida; a UI omite o nome, nunca inventa. */
  establishment_name: string | null;
  /** Início do primeiro set da noite. É ele que decide o período. */
  started_at: Date;
  /** Fim do último set. `null` só se nenhum set tiver fim gravado. */
  ended_at: Date | null;
  sets_count: number;
  songs_played: number;
  requests_received: number;
  requests_played: number;
  requests_rejected: number;
  tips_count: number;
  tips_total: number;
  /** Presenças marcadas no evento — do evento inteiro, como no relatório. */
  attendees: number;
};

export type MusicianNightsSummary = {
  nights: number;
  songs_played: number;
  requests_received: number;
  requests_played: number;
  tips_count: number;
  tips_total: number;
  /** Soma de presenças noite a noite — o mesmo fã em duas noites conta duas. */
  attendance: number;
  /** Pessoas DISTINTAS no período — o número do currículo, recortado. */
  audience_reached: number;
};

export type MusicianNightsWindow = {
  /** Inclusivo. */
  from: Date;
  /** Exclusivo. */
  to: Date;
};

export type GetMusicianNightsOutput = {
  musician_id: string;
  period_days: NightPeriodDays;
  current: MusicianNightsWindow & {
    /** Da mais antiga para a mais recente — a ordem do espectro. */
    nights: MusicianNightOutput[];
    summary: MusicianNightsSummary;
  };
  previous: MusicianNightsWindow & { summary: MusicianNightsSummary };
};

/**
 * As noites do músico num período, e o período anterior do mesmo tamanho —
 * o "master" do Analytics do app.
 *
 * ## Por que existe
 *
 * `GET /musicians/:id/analytics` é all-time: não havia série nenhuma para o
 * músico (a tabela `musician_analytics` existe e nada a escreve). Montar as
 * noites no celular custaria um relatório por show — dezenas de requisições
 * na rede de um bar.
 *
 * ## Mesmas regras do relatório pós-show, em lote
 *
 * Cada número tem a definição de `GetPerformanceReportUseCase`, para que a
 * noite no Analytics e o relatório daquela noite nunca discordem:
 *  - pedidos = evento + músico;
 *  - gorjeta = só CONFIRMADA, do evento, para o músico OU para a banda do set;
 *  - público = presenças marcadas no evento.
 * A diferença é a forma: quatro consultas em lote, não quatro por show.
 *
 * ## A noite é o EVENTO, não o set
 *
 * Fechar e reabrir o set no mesmo show gera dois `Performance` no mesmo
 * evento. Contá-los como duas noites dobraria pedidos, gorjetas e público —
 * que são do evento, não do set.
 *
 * ## Janelas encostadas, em instantes
 *
 * "Últimos 30 dias" são 30 × 24h até agora, e o anterior os 30 × 24h antes
 * disso — sem buraco nem sobreposição. A noite cai no período pelo início do
 * primeiro set. O app agrupa e rotula no fuso do aparelho; o servidor não
 * conhece o fuso do músico e não finge conhecer.
 */
export class GetMusicianNightsUseCase implements IUseCase<
  GetMusicianNightsInput,
  GetMusicianNightsOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly planCheckService: PlanCheckService,
    private readonly performanceRepo: IPerformanceRepository,
    private readonly requestRepo: IRequestRepository,
    private readonly tipRepo: ITipRepository,
    private readonly attendeeRepo: IEventAttendeeRepository,
    private readonly establishmentRepo: IEstablishmentRepository,
  ) {}

  async execute(input: GetMusicianNightsInput): Promise<GetMusicianNightsOutput> {
    const musician = await this.musicianRepo.findById(
      new MusicianId(input.musician_id),
    );
    if (!musician) {
      throw new NotFoundError(input.musician_id, Musician);
    }

    // Mesmo gate do Analytics all-time (9.7a), e ANTES das consultas: o FREE
    // não paga leitura cujo resultado não vai receber.
    await this.planCheckService.assertMusicianFeature(
      input.musician_id,
      "realtime_analytics",
    );

    const now = input.now ?? new Date();
    const span = input.days * DAY_MS;
    const current = { from: new Date(now.getTime() - span), to: now };
    const previous = {
      from: new Date(now.getTime() - 2 * span),
      to: current.from,
    };

    const performances = await this.performanceRepo.findEndedByMusician({
      musician_id: input.musician_id,
      started_from: previous.from,
    });

    const byEvent = groupByEvent(performances);
    const eventIds = [...byEvent.keys()];

    const [requests, tips, attendance, names] = await Promise.all([
      this.requestRepo.findByMusicianAndEvents(input.musician_id, eventIds),
      this.tipRepo.findCompletedByEvents(eventIds),
      this.attendeeRepo.countByEvents(eventIds),
      this.loadVenueNames(performances),
    ]);

    const requestsByEvent = groupBy(requests, (r) => r.event_id.id);
    const tipsByEvent = groupBy(tips, (t) => t.event_id?.id ?? null);

    const nights = [...byEvent.entries()].map(([eventId, sets]) =>
      buildNight({
        eventId,
        sets,
        requests: requestsByEvent.get(eventId) ?? [],
        tips: (tipsByEvent.get(eventId) ?? []).filter((tip) =>
          isForSets(tip, sets),
        ),
        attendees: attendance.get(eventId) ?? 0,
        names,
      }),
    );

    const inWindow = (night: MusicianNightOutput, w: MusicianNightsWindow) =>
      night.started_at.getTime() >= w.from.getTime() &&
      night.started_at.getTime() < w.to.getTime();

    const currentNights = nights
      .filter((night) => inWindow(night, current))
      .sort((a, b) => a.started_at.getTime() - b.started_at.getTime());
    const previousNights = nights.filter((night) => inWindow(night, previous));

    const [currentReach, previousReach] = await Promise.all([
      this.attendeeRepo.countDistinctAudienceByEvents(
        currentNights.map((n) => n.event_id),
      ),
      this.attendeeRepo.countDistinctAudienceByEvents(
        previousNights.map((n) => n.event_id),
      ),
    ]);

    return {
      musician_id: input.musician_id,
      period_days: input.days,
      current: {
        ...current,
        nights: currentNights,
        summary: summarize(currentNights, currentReach),
      },
      previous: {
        ...previous,
        summary: summarize(previousNights, previousReach),
      },
    };
  }

  private async loadVenueNames(
    performances: Performance[],
  ): Promise<Map<string, string>> {
    const ids = [...new Set(performances.map((p) => p.establishment_id.id))];
    const venues = await Promise.all(
      ids.map((id) => this.establishmentRepo.findById(new EstablishmentId(id))),
    );
    const names = new Map<string, string>();
    for (const venue of venues) {
      if (venue) names.set(venue.establishment_id.id, venue.name);
    }
    return names;
  }
}

function groupByEvent(performances: Performance[]): Map<string, Performance[]> {
  return groupBy(performances, (p) => p.event_id.id) as Map<string, Performance[]>;
}

function groupBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    const list = groups.get(k) ?? [];
    list.push(item);
    groups.set(k, list);
  }
  return groups;
}

/**
 * Um evento tem mais de um artista, e o filtro por evento não distingue
 * destinatário — sem isto a noite somaria a gorjeta dada a OUTRO músico do
 * mesmo show. Show de banda: a gorjeta chega em `band_id`.
 */
function isForSets(tip: Tip, sets: Performance[]): boolean {
  return sets.some(
    (set) =>
      tip.musician_id?.id === set.musician_id.id ||
      (!!set.band_id && tip.band_id?.id === set.band_id.id),
  );
}

function buildNight(params: {
  eventId: string;
  sets: Performance[];
  requests: Request[];
  tips: Tip[];
  attendees: number;
  names: Map<string, string>;
}): MusicianNightOutput {
  const { eventId, sets, requests, tips, attendees, names } = params;
  const first = sets.reduce((a, b) =>
    a.started_at.getTime() <= b.started_at.getTime() ? a : b,
  );
  const ends = sets
    .map((s) => s.ended_at)
    .filter((d): d is Date => !!d)
    .map((d) => d.getTime());

  return {
    event_id: eventId,
    establishment_id: first.establishment_id.id,
    establishment_name: names.get(first.establishment_id.id) ?? null,
    started_at: first.started_at,
    ended_at: ends.length > 0 ? new Date(Math.max(...ends)) : null,
    sets_count: sets.length,
    songs_played: sets.reduce((acc, s) => acc + s.songs_count, 0),
    requests_received: requests.length,
    requests_played: requests.filter((r) => r.status.isPlayed()).length,
    requests_rejected: requests.filter((r) => r.status.isRejected()).length,
    tips_count: tips.length,
    tips_total: sumMoney(tips.map((t) => t.amount.amount)),
    attendees,
  };
}

function summarize(
  nights: MusicianNightOutput[],
  audienceReached: number,
): MusicianNightsSummary {
  const total = (pick: (n: MusicianNightOutput) => number) =>
    nights.reduce((acc, n) => acc + pick(n), 0);

  return {
    nights: nights.length,
    songs_played: total((n) => n.songs_played),
    requests_received: total((n) => n.requests_received),
    requests_played: total((n) => n.requests_played),
    tips_count: total((n) => n.tips_count),
    tips_total: sumMoney(nights.map((n) => n.tips_total)),
    attendance: total((n) => n.attendees),
    audience_reached: audienceReached,
  };
}

/** Soma em CENTAVOS inteiros — `0.1 + 0.2` em reais não fecha. */
function sumMoney(values: number[]): number {
  const cents = values.reduce((acc, v) => acc + Math.round(v * 100), 0);
  return cents / 100;
}
