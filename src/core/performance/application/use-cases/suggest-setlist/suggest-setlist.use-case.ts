import {
  IMusicLibraryRepository,
  MusicLibrarySearchParams,
} from "../../../../music-library/domain/music-library.repository";
import {
  IRequestRepository,
  RequestSearchParams,
} from "../../../../request/domain/request.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IPerformanceRepository } from "../../../domain/performance.repository";

/**
 * Pesos do ranking — declarados aqui, em constante nomeada, de propósito.
 *
 * Não há modelo, treino nem score opaco: é contagem com peso legível em code
 * review, pela mesma razão que o catálogo de cláusulas do contrato é código e
 * não banco. Quem discorda de uma sugestão precisa poder discordar do MOTIVO.
 */
const WEIGHTS = {
  /** Pediram e o músico tocou: o sinal mais forte que existe naquele local. */
  REQUEST_PLAYED: 5,
  /** Pediram e ele aceitou — intenção confirmada dos dois lados. */
  REQUEST_ACCEPTED: 4,
  /** Pediram e não rolou: a demanda existe e continua não atendida. */
  REQUEST_UNANSWERED: 3,
  /** Ele já tocou ali e funcionou o bastante para repetir. */
  PLAYED_AT_VENUE: 2,
} as const;

/** Sugerir cem músicas é não sugerir nenhuma. */
const DEFAULT_LIMIT = 20;

const REQUESTS_PAGE_SIZE = 500;
const LIBRARY_PAGE_SIZE = 500;

export type SuggestSetlistInput = {
  musician_id: string;
  establishment_id: string;
  limit?: number;
};

export type SetlistEvidence = {
  /** De onde veio o sinal — o texto que a UI mostra sob a sugestão. */
  reason:
    | "requested_and_played"
    | "requested_and_accepted"
    | "requested_not_played"
    | "played_here_before"
    | "in_repertoire_never_played_here";
  occurrences: number;
  last_seen_at: Date | null;
};

export type SetlistSuggestionOutput = {
  music_library_id: string | null;
  title: string;
  artist: string;
  score: number;
  evidence: SetlistEvidence[];
};

export type SuggestSetlistOutput = {
  musician_id: string;
  establishment_id: string;
  suggestions: SetlistSuggestionOutput[];
  /**
   * Quantos sinais reais sustentam a lista. Zero significa "ainda não sabemos
   * nada deste local" — a UI precisa dizer isso em vez de fingir insight.
   */
  evidence_count: number;
};

type Bucket = {
  music_library_id: string | null;
  title: string;
  artist: string;
  score: number;
  evidence: SetlistEvidence[];
};

/**
 * Setlist inteligente por local (F5).
 *
 * Ranqueia por **evidência daquele estabelecimento**, não por popularidade
 * geral: o que enche um bar de sertanejo esvazia um de jazz, e uma média
 * nacional entregaria exatamente a sugestão errada para os dois.
 *
 * 🔴 **Sugestão sem evidência exibível não é sugestão, é palpite.** Por isso
 * cada item carrega `evidence` com origem e contagem: o músico precisa poder
 * discordar do motivo, e um número sem procedência ele não tem como avaliar.
 *
 * Read model puro, calculado na leitura — mesmo precedente de
 * `establishment-analytics.read-model.ts`. Não há estado a mutar.
 */
export class SuggestSetlistUseCase implements IUseCase<
  SuggestSetlistInput,
  SuggestSetlistOutput
> {
  constructor(
    private readonly performanceRepo: IPerformanceRepository,
    private readonly requestRepo: IRequestRepository,
    private readonly musicLibraryRepo: IMusicLibraryRepository,
  ) {}

  async execute(input: SuggestSetlistInput): Promise<SuggestSetlistOutput> {
    const limit = input.limit ?? DEFAULT_LIMIT;

    const [playsHere, requestsHere, library] = await Promise.all([
      this.performanceRepo.countPlaysByMusicianAtEstablishment({
        musician_id: input.musician_id,
        establishment_id: input.establishment_id,
      }),
      this.loadRequestsAtVenue(input),
      this.loadLibrary(input.musician_id),
    ]);

    const buckets = new Map<string, Bucket>();

    // 1. Pedidos naquele local — o sinal que vem do público.
    for (const request of requestsHere) {
      const title = request.song_title.value;
      const artist = request.artist?.trim() || "Artista não informado";

      const { weight, reason } = request.status.isPlayed()
        ? {
            weight: WEIGHTS.REQUEST_PLAYED,
            reason: "requested_and_played" as const,
          }
        : request.status.isAccepted()
          ? {
              weight: WEIGHTS.REQUEST_ACCEPTED,
              reason: "requested_and_accepted" as const,
            }
          : {
              weight: WEIGHTS.REQUEST_UNANSWERED,
              reason: "requested_not_played" as const,
            };

      this.addSignal(buckets, {
        music_library_id: null,
        title,
        artist,
        weight,
        reason,
        at: request.created_at,
      });
    }

    // 2. O que ele já tocou ali.
    for (const play of playsHere) {
      this.addSignal(buckets, {
        music_library_id: play.music_library_id,
        title: play.title,
        artist: play.artist,
        weight: WEIGHTS.PLAYED_AT_VENUE * play.plays,
        reason: "played_here_before",
        at: play.last_played_at,
        occurrences: play.plays,
      });
    }

    // Quantos sinais REAIS existem, antes de completar com o repertório. É o
    // que separa "sugestão" de "lista do que você já tem cadastrado".
    const evidenceCount = buckets.size;

    // 3. O "esquenta o repertório", virado do avesso: o valor está no que ainda
    //    não foi tocado ali, não no que já se repete. Entra com score zero, só
    //    para preencher a lista quando a evidência acaba — nunca à frente de
    //    quem tem sinal.
    for (const song of library) {
      const key = this.keyFor(song.title, song.artist);
      if (buckets.has(key)) continue;

      buckets.set(key, {
        music_library_id: song.music_library_id.id,
        title: song.title,
        artist: song.artist,
        score: 0,
        evidence: [
          {
            reason: "in_repertoire_never_played_here",
            occurrences: 0,
            last_seen_at: null,
          },
        ],
      });
    }

    const suggestions = Array.from(buckets.values())
      .sort(
        (a, b) =>
          b.score - a.score ||
          this.lastSeen(b) - this.lastSeen(a) ||
          a.title.localeCompare(b.title),
      )
      .slice(0, limit);

    return {
      musician_id: input.musician_id,
      establishment_id: input.establishment_id,
      suggestions,
      evidence_count: evidenceCount,
    };
  }

  /**
   * Pedidos feitos para este músico neste estabelecimento.
   *
   * `MusicRequest` guarda `eventId`, não `establishmentId` — então o recorte
   * por local passa pelos sets já registrados ali. Consequência assumida: antes
   * de o músico abrir o primeiro set naquele bar, não há pedidos "daquele
   * local" para cruzar, e a sugestão cai no repertório. Preferível a cruzar
   * pedidos do país inteiro e chamar isso de inteligência por local.
   */
  private async loadRequestsAtVenue(input: SuggestSetlistInput) {
    const performances = await this.performanceRepo.findEndedByMusician({
      musician_id: input.musician_id,
      establishment_id: input.establishment_id,
    });

    const eventIds = Array.from(
      new Set(performances.map((p) => p.event_id.id)),
    );

    if (eventIds.length === 0) return [];

    const results = await Promise.all(
      eventIds.map((event_id) =>
        this.requestRepo.search(
          RequestSearchParams.create({
            page: 1,
            per_page: REQUESTS_PAGE_SIZE,
            filter: { event_id, musician_id: input.musician_id },
          }),
        ),
      ),
    );

    return results.flatMap((r) => r.items);
  }

  private async loadLibrary(musician_id: string) {
    const result = await this.musicLibraryRepo.search(
      MusicLibrarySearchParams.create({
        page: 1,
        per_page: LIBRARY_PAGE_SIZE,
        filter: { musician_id },
      }),
    );
    return result.items;
  }

  private addSignal(
    buckets: Map<string, Bucket>,
    signal: {
      music_library_id: string | null;
      title: string;
      artist: string;
      weight: number;
      reason: SetlistEvidence["reason"];
      at: Date;
      occurrences?: number;
    },
  ): void {
    const key = this.keyFor(signal.title, signal.artist);
    const existing = buckets.get(key);
    const occurrences = signal.occurrences ?? 1;

    if (!existing) {
      buckets.set(key, {
        music_library_id: signal.music_library_id,
        title: signal.title,
        artist: signal.artist,
        score: signal.weight,
        evidence: [
          {
            reason: signal.reason,
            occurrences,
            last_seen_at: signal.at,
          },
        ],
      });
      return;
    }

    existing.score += signal.weight;
    // O ponteiro para a biblioteca é preservado assim que qualquer sinal o
    // traz: é o que permite ao app abrir a cifra direto da sugestão.
    existing.music_library_id ??= signal.music_library_id;

    const sameReason = existing.evidence.find(
      (e) => e.reason === signal.reason,
    );

    if (sameReason) {
      sameReason.occurrences += occurrences;
      if (!sameReason.last_seen_at || signal.at > sameReason.last_seen_at) {
        sameReason.last_seen_at = signal.at;
      }
      return;
    }

    existing.evidence.push({
      reason: signal.reason,
      occurrences,
      last_seen_at: signal.at,
    });
  }

  /**
   * Agrupa por título+artista em minúsculas.
   *
   * Sem normalizar, "Evidências" pedida por um fã e "evidências" tocada pelo
   * músico virariam duas sugestões concorrendo entre si — e nenhuma das duas
   * acumularia sinal suficiente para subir.
   */
  private keyFor(title: string, artist: string): string {
    return `${title.trim().toLowerCase()}::${artist.trim().toLowerCase()}`;
  }

  private lastSeen(bucket: Bucket): number {
    return bucket.evidence.reduce(
      (acc, e) => Math.max(acc, e.last_seen_at?.getTime() ?? 0),
      0,
    );
  }
}
