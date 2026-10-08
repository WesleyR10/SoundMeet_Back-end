import { EstablishmentId } from "../../../../establishment/domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../../establishment/domain/establishment.repository";
import { Event } from "../../../../events/domain/event.aggregate";
import {
  EventSearchParams,
  IEventRepository,
} from "../../../../events/domain/event.repository";
import { EventMusician } from "../../../../events/domain/event-musician.aggregate";
import {
  EventMusicianSearchParams,
  IEventMusicianRepository,
} from "../../../../events/domain/event-musician.repository";
import { BandId } from "../../../../musician/domain/band.aggregate";
import { IBandRepository } from "../../../../musician/domain/band.repository";
import { MusicianId } from "../../../../musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../../musician/domain/musician.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { haversineKm } from "../../../../shared/domain/geo.utils";
import { Performance } from "../../../domain/performance.aggregate";
import {
  IPerformanceRepository,
  PerformanceSearchParams,
} from "../../../domain/performance.repository";

/**
 * Quanto para trás procurar o INÍCIO de um show que ainda está acontecendo.
 * O filtro de data do repositório olha `start_at`; um show que começou às
 * 22:00 de ontem e vai até 02:00 tem início no passado e é justamente o que
 * está no ar agora. Mesma folga de 12h que a agenda do web usa.
 */
const LIVE_LOOKBACK_MS = 12 * 60 * 60 * 1000;
const UPCOMING_DAYS = 7;
const DEFAULT_LIMIT = 10;
export const STAGES_MAX_LIMIT = 20;
/** Teto de escalações por evento — um palco com 20 atos já é festival. */
const LINEUP_PAGE_SIZE = 20;

export type StagesWindow = "live" | "upcoming";

export type ListStagesInput = {
  window: StagesWindow;
  /**
   * Coordenadas do fã. Com `lat`+`lng` o cartaz ganha distância e ordem por
   * proximidade; só com o TRIO (`radius_km` junto) ele passa a FILTRAR — mesmo
   * contrato do `EventFilter`. Ordenar sem filtrar é o default do app de
   * propósito: um raio que não pega nenhum palco deixaria a Home vazia numa
   * noite em que há show a 60 km.
   */
  lat?: number | null;
  lng?: number | null;
  radius_km?: number | null;
  limit?: number | null;
  now?: Date;
};

export type StageVenueOutput = {
  establishment_id: string;
  name: string;
  avatar: string | null;
  cover: string | null;
  establishment_type: string;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  /** `null` sem coordenadas do fã OU sem coordenadas da casa — nunca zero. */
  distance_km: number | null;
};

export type StageNowPlayingOutput = {
  title: string;
  artist: string;
  spotify_url: string | null;
};

export type StagePerformerOutput = {
  musician_id: string | null;
  band_id: string | null;
  name: string;
  avatar: string | null;
  genres: string[];
  /** Há set aberto AGORA para este ato neste evento. */
  is_on_stage: boolean;
  /** `null` entre músicas ou sem set — nunca a lista do set. */
  now_playing: StageNowPlayingOutput | null;
  songs_count: number;
};

export type StageOutput = {
  event_id: string;
  name: string;
  start_at: Date;
  end_at: Date;
  status: string;
  cover_charge: number | null;
  attendees_count: number;
  max_capacity: number | null;
  venue: StageVenueOutput;
  lineup: StagePerformerOutput[];
};

export type ListStagesOutput = {
  window: StagesWindow;
  generated_at: Date;
  stages: StageOutput[];
};

/**
 * Os palcos da noite, prontos para a Home do fã — uma chamada, um cartão
 * inteiro por show.
 *
 * ## Por que existe (e por que mora em `performance`)
 *
 * `GET /events` devolve só `establishment_id`: montar o cartão "ao vivo agora"
 * no aparelho custava, por show, a casa + o line-up + cada músico + o "tocando
 * agora" de cada um — umas quatro idas à rede por cartão, na rede de um bar.
 * Este caso de uso faz a junção no servidor.
 *
 * Mora em `performance` porque é o único módulo que já enxerga eventos, casas,
 * músicos, bandas E sets sem fechar ciclo: `PerformanceModule` é nó-folha.
 *
 * ## O que ele NÃO expõe, de propósito
 *
 * - **Cachê** (`EventMusician.fee`): a rota é lida pelo público. Mesma regra
 *   do currículo verificado.
 * - **O set inteiro**: só a música do momento, como `/performances/live`.
 * - **Dedicatória**: essa passa pelo portão de "só depois de pago" em
 *   `/performances/live`, e duplicá-la aqui criaria um segundo lugar onde o
 *   portão pode ser esquecido. O cartão da Home não precisa dela.
 * - **Escalação `pending`/`cancelled`**: só `confirmed` sobe ao cartaz. Um
 *   nome que a casa ainda não confirmou, publicado como atração, é promessa
 *   que o sistema não pode sustentar.
 * - **Evento privado**: `is_public: true` é forçado aqui, como na descoberta.
 */
export class ListStagesUseCase implements IUseCase<
  ListStagesInput,
  ListStagesOutput
> {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly eventMusicianRepo: IEventMusicianRepository,
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly musicianRepo: IMusicianRepository,
    private readonly bandRepo: IBandRepository,
    private readonly performanceRepo: IPerformanceRepository,
  ) {}

  async execute(input: ListStagesInput): Promise<ListStagesOutput> {
    const now = input.now ?? new Date();
    const limit = clampLimit(input.limit);
    const origin = fanOrigin(input);
    const geo = completeGeo(input);

    const events = await this.findEvents(input.window, now, limit, geo);

    const [venues, lineups, liveSets] = await Promise.all([
      this.loadVenues(events),
      this.loadLineups(events),
      input.window === "live"
        ? this.loadLiveSets(events)
        : Promise.resolve(new Map<string, Performance[]>()),
    ]);
    const acts = await this.loadActs([...lineups.values()].flat());

    const stages: StageOutput[] = [];
    for (const event of events) {
      const establishment = venues.get(event.establishment_id.id);
      // Casa removida ou desativada não tem cartaz — um cartão sem casa não
      // diz ao fã para onde ir.
      if (!establishment || !establishment.is_active) continue;

      const location = establishment.profile?.location ?? null;
      const sets = liveSets.get(event.event_id.id) ?? [];

      const lineup = (lineups.get(event.event_id.id) ?? [])
        .map((slot) => toPerformer(slot, acts, sets))
        .filter((p): p is StagePerformerOutput => p !== null)
        // Quem está no palco primeiro: é a resposta para "quem eu vejo agora?".
        .sort((a, b) => Number(b.is_on_stage) - Number(a.is_on_stage));

      stages.push({
        event_id: event.event_id.id,
        name: event.name,
        start_at: event.start_at,
        end_at: event.end_at,
        status: event.status,
        cover_charge: event.cover_charge,
        attendees_count: event.current_capacity,
        max_capacity: event.max_capacity,
        venue: {
          establishment_id: establishment.establishment_id.id,
          name: establishment.name,
          avatar: establishment.avatar,
          cover: establishment.cover,
          establishment_type: establishment.establishment_type,
          neighborhood: location?.neighborhood ?? null,
          city: location?.city ?? null,
          state: location?.state ?? null,
          distance_km: distanceTo(origin, location),
        },
        lineup,
      });
    }

    return {
      window: input.window,
      generated_at: now,
      stages: sortStages(stages, input.window).slice(0, limit),
    };
  }

  private async findEvents(
    window: StagesWindow,
    now: Date,
    limit: number,
    geo: Geo | null,
  ): Promise<Event[]> {
    const range =
      window === "live"
        ? {
            date_gte: new Date(now.getTime() - LIVE_LOOKBACK_MS),
            date_lte: now,
          }
        : {
            date_gte: now,
            date_lte: new Date(now.getTime() + UPCOMING_DAYS * 86_400_000),
          };

    const result = await this.eventRepo.search(
      EventSearchParams.create({
        page: 1,
        // Folga sobre o limite: cancelados e encerrados caem no filtro abaixo,
        // e o cartaz não pode sair mais curto do que o pedido por causa deles.
        per_page: limit * 3,
        sort: "startTime",
        sort_dir: "asc",
        filter: {
          is_public: true,
          ...range,
          ...(geo ?? {}),
        },
      }),
    );

    return result.items.filter((event) => {
      if (event.status === "cancelled" || event.status === "completed") {
        return false;
      }
      // "Ao vivo" é o relógio, não só o status: o job de auto-finalização
      // passa a cada 10 min, e nessa janela um show já terminado ainda está
      // `active`. Anunciá-lo como "rolando agora" mandaria o fã a uma casa
      // vazia.
      return window === "live" ? event.end_at > now : true;
    });
  }

  private async loadVenues(events: Event[]) {
    const ids = unique(events.map((e) => e.establishment_id.id));
    const establishments = ids.length
      ? await this.establishmentRepo.findByIds(
          ids.map((id) => new EstablishmentId(id)),
        )
      : [];
    return new Map(establishments.map((e) => [e.establishment_id.id, e]));
  }

  private async loadLineups(events: Event[]) {
    const entries = await Promise.all(
      events.map(async (event) => {
        const result = await this.eventMusicianRepo.search(
          EventMusicianSearchParams.create({
            page: 1,
            per_page: LINEUP_PAGE_SIZE,
            filter: { event_id: event.event_id.id, status: "confirmed" },
          }),
        );
        return [event.event_id.id, result.items] as const;
      }),
    );
    return new Map<string, EventMusician[]>(entries);
  }

  private async loadLiveSets(events: Event[]) {
    const entries = await Promise.all(
      events.map(async (event) => {
        const result = await this.performanceRepo.search(
          PerformanceSearchParams.create({
            page: 1,
            per_page: LINEUP_PAGE_SIZE,
            filter: { event_id: event.event_id.id, status: "live" },
          }),
        );
        return [event.event_id.id, result.items] as const;
      }),
    );
    return new Map<string, Performance[]>(entries);
  }

  private async loadActs(slots: EventMusician[]): Promise<Acts> {
    const musicianIds = unique(
      slots.map((s) => s.musician_id?.id).filter(isString),
    );
    const bandIds = unique(slots.map((s) => s.band_id?.id).filter(isString));

    const [musicians, bands] = await Promise.all([
      musicianIds.length
        ? this.musicianRepo.findByIds(musicianIds.map((id) => new MusicianId(id)))
        : [],
      bandIds.length
        ? this.bandRepo.findByIds(bandIds.map((id) => new BandId(id)))
        : [],
    ]);

    const acts: Acts = new Map();
    for (const m of musicians) {
      if (!m.is_active) continue;
      acts.set(`m:${m.musician_id.id}`, {
        name: m.displayName,
        avatar: m.avatar,
        genres: m.genres,
      });
    }
    for (const b of bands) {
      acts.set(`b:${b.band_id.id}`, {
        name: b.name,
        avatar: b.avatar,
        genres: b.genres,
      });
    }
    return acts;
  }
}

type Origin = { lat: number; lng: number };
type Geo = Origin & { radius_km: number };

/** Acima disto o palco é "longe": não dá para chegar no show de hoje. */
export const NEAR_KM = 50;

function fanOrigin(input: ListStagesInput): Origin | null {
  const { lat, lng } = input;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
type Act = { name: string; avatar: string | null; genres: string[] };
type Acts = Map<string, Act>;

function completeGeo(input: ListStagesInput): Geo | null {
  const origin = fanOrigin(input);
  const { radius_km } = input;
  if (
    !origin ||
    typeof radius_km !== "number" ||
    !Number.isFinite(radius_km) ||
    radius_km <= 0
  ) {
    return null;
  }
  return { ...origin, radius_km };
}

function clampLimit(limit: number | null | undefined): number {
  if (!limit || !Number.isFinite(limit) || limit < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), STAGES_MAX_LIMIT);
}

function distanceTo(
  geo: Origin | null,
  location: { latitude?: number; longitude?: number } | null,
): number | null {
  if (
    !geo ||
    typeof location?.latitude !== "number" ||
    typeof location?.longitude !== "number"
  ) {
    return null;
  }
  const km = haversineKm(geo.lat, geo.lng, location.latitude, location.longitude);
  return Math.round(km * 10) / 10;
}

/**
 * Um ato do cartaz. Banda ganha de músico quando a escalação tem as duas
 * chaves: quem sobe ao palco é o nome da banda.
 *
 * O set de uma banda é aberto pelo MÚSICO que o opera, com `band_id`
 * preenchido — por isso a busca do set casa pelos dois lados.
 */
function toPerformer(
  slot: EventMusician,
  acts: Acts,
  sets: Performance[],
): StagePerformerOutput | null {
  const bandId = slot.band_id?.id ?? null;
  const musicianId = slot.musician_id?.id ?? null;
  const act = bandId ? acts.get(`b:${bandId}`) : acts.get(`m:${musicianId}`);
  if (!act) return null;

  const set = bandId
    ? sets.find((p) => p.band_id?.id === bandId)
    : sets.find((p) => p.musician_id.id === musicianId && !p.band_id);
  const current = set?.current_song ?? null;

  return {
    musician_id: bandId ? null : musicianId,
    band_id: bandId,
    name: act.name,
    avatar: act.avatar,
    genres: act.genres,
    is_on_stage: !!set,
    now_playing: current
      ? {
          title: current.title,
          artist: current.artist,
          spotify_url: current.spotify_track_id
            ? `https://open.spotify.com/track/${current.spotify_track_id}`
            : null,
        }
      : null,
    songs_count: set?.songs_count ?? 0,
  };
}

/**
 * Ao vivo: primeiro o que dá para ALCANÇAR (até `NEAR_KM`, ou distância
 * desconhecida); dentro disso, palco com set aberto na frente (é o que o fã
 * vive AGORA), depois o mais perto, depois o mais cheio. Um set aberto a 800 km
 * não ganha de um show na esquina que ainda não começou.
 *
 * Próximos: o que começa antes.
 */
export function sortStages(
  stages: StageOutput[],
  window: StagesWindow,
): StageOutput[] {
  const copy = [...stages];
  if (window === "upcoming") {
    return copy.sort((a, b) => a.start_at.getTime() - b.start_at.getTime());
  }
  const onStage = (s: StageOutput) => s.lineup.some((p) => p.is_on_stage);
  const far = (s: StageOutput) =>
    s.venue.distance_km !== null && s.venue.distance_km > NEAR_KM;
  return copy.sort((a, b) => {
    const byReach = Number(far(a)) - Number(far(b));
    if (byReach !== 0) return byReach;
    const byStage = Number(onStage(b)) - Number(onStage(a));
    if (byStage !== 0) return byStage;
    const da = a.venue.distance_km;
    const db = b.venue.distance_km;
    if (da !== null && db !== null && da !== db) return da - db;
    const byCrowd = b.attendees_count - a.attendees_count;
    if (byCrowd !== 0) return byCrowd;
    return a.start_at.getTime() - b.start_at.getTime();
  });
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isString(value: string | undefined | null): value is string {
  return typeof value === "string";
}
