import { ForbiddenException } from "@nestjs/common";

import { EstablishmentId } from "../../../../establishment/domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../../establishment/domain/establishment.repository";
import { IEventAttendeeRepository } from "../../../../events/domain/event-attendee.repository";
import {
  ITipRepository,
  TipSearchParams,
} from "../../../../payment/domain/repositories/tip.repository";
import { TipStatus } from "../../../../payment/domain/tip-enums";
import {
  IRequestRepository,
  RequestSearchParams,
} from "../../../../request/domain/request.repository";
import { RepertoireId } from "../../../../repertoire/domain/repertoire.aggregate";
import { IRepertoireRepository } from "../../../../repertoire/domain/repertoire.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import {
  Performance,
  PerformanceId,
} from "../../../domain/performance.aggregate";
import { IPerformanceRepository } from "../../../domain/performance.repository";
import {
  PerformanceOutputMapper,
  PerformedSongOutput,
} from "../common/performance-output";

/** Página grande o bastante para um show inteiro numa consulta só. */
const REQUESTS_PAGE_SIZE = 200;

/** Um show não passa disso em gorjetas; evita paginar no caminho de leitura. */
const TIPS_PAGE_SIZE = 500;

/** Janela usada para associar gorjeta a música. Ver a nota sobre heurística. */
const TIP_ATTRIBUTION_WINDOW_MS = 5 * 60 * 1000;

export type GetPerformanceReportInput = {
  performance_id: string;
  /** Do JWT. */
  requesting_musician_id: string;
};

export type PerformanceReportSongOutput = PerformedSongOutput & {
  /**
   * 🔴 HEURÍSTICA, não causalidade. É a contagem de gorjetas pagas cuja hora
   * cai na janela desta música. Não afirma que a música rendeu a gorjeta — o
   * dado não sustenta isso, e o campo é nomeado para deixar claro.
   */
  tips_during_song: number;
};

export type GetPerformanceReportOutput = {
  performance_id: string;
  event_id: string;
  establishment_id: string;
  /**
   * Nome da casa no momento da leitura, para o card compartilhável (B1).
   *
   * `null` quando o estabelecimento foi removido — a UI omite a linha em vez de
   * inventar "local desconhecido". O relatório continua válido sem ele: o que
   * prova o show é a `Performance`, não o nome.
   */
  establishment_name: string | null;
  musician_id: string;
  band_id: string | null;
  started_at: Date;
  ended_at: Date;
  duration_seconds: number | null;

  songs_count: number;
  /** Músicas distintas — bis não conta duas vezes. */
  unique_songs_count: number;
  songs: PerformanceReportSongOutput[];

  requests_received: number;
  requests_accepted: number;
  requests_rejected: number;
  requests_played: number;

  tips_count: number;
  tips_total: number;

  attendees_count: number;

  /**
   * Plano × execução: quantas músicas da setlist programada foram tocadas.
   * `null` quando o show não teve setlist (improviso) ou o repertório foi
   * apagado depois — a UI omite a linha em vez de dizer "0 de 0".
   *
   * Conta MÚSICAS DISTINTAS da setlist que aparecem no set (por
   * `music_library_id`): bis não infla o "tocou", e música tocada fora da
   * setlist não conta como parte dela.
   */
  setlist: { planned_count: number; played_count: number } | null;

  /**
   * Diz ao cliente que a atribuição de gorjeta por música é aproximada, para
   * que a UI não a apresente como fato. Constante, e é de propósito: a nota
   * viaja com o dado em vez de depender de o front lembrar de escrevê-la.
   */
  tips_attribution_note: string;
};

/**
 * Relatório pós-show (F6) — "18 músicas, 6 pedidos aceitos, R$ 210 em gorjetas".
 *
 * ## Só para set encerrado
 *
 * Relatório de show em andamento é um número que muda enquanto se olha, e o
 * músico o leria no palco — exatamente onde ele não deveria estar olhando para
 * métricas. Set aberto responde 422, não um retrato parcial.
 *
 * ## Não é persistido
 *
 * É projeção calculada na leitura, seguindo o precedente de
 * `establishment-analytics.read-model.ts`: não há estado próprio para mutar, e
 * materializar criaria uma segunda verdade para sair de sincronia quando um
 * pedido mudasse de status depois.
 */
export class GetPerformanceReportUseCase implements IUseCase<
  GetPerformanceReportInput,
  GetPerformanceReportOutput
> {
  constructor(
    private readonly performanceRepo: IPerformanceRepository,
    private readonly requestRepo: IRequestRepository,
    private readonly tipRepo: ITipRepository,
    private readonly attendeeRepo: IEventAttendeeRepository,
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly repertoireRepo?: IRepertoireRepository,
  ) {}

  async execute(
    input: GetPerformanceReportInput,
  ): Promise<GetPerformanceReportOutput> {
    const performance = await this.performanceRepo.findById(
      new PerformanceId(input.performance_id),
    );

    if (!performance) {
      throw new NotFoundError(input.performance_id, Performance);
    }

    if (!performance.isOwnedBy(input.requesting_musician_id)) {
      throw new ForbiddenException("Este set não é seu.");
    }

    if (!performance.status.isEnded() || !performance.ended_at) {
      throw new ForbiddenException(
        "O relatório fica disponível quando o show é encerrado.",
      );
    }

    const [requests, tips, attendees, establishment, setlist] = await Promise.all([
      this.loadRequests(performance),
      this.loadPaidTips(performance),
      this.attendeeRepo.findByEvent(new Uuid(performance.event_id.id)),
      this.establishmentRepo.findById(
        new EstablishmentId(performance.establishment_id.id),
      ),
      this.loadSetlistCoverage(performance),
    ]);

    const tipTimes = tips.map((t) => t.created_at.getTime());

    return {
      performance_id: performance.performance_id.id,
      event_id: performance.event_id.id,
      establishment_id: performance.establishment_id.id,
      establishment_name: establishment?.name ?? null,
      musician_id: performance.musician_id.id,
      band_id: performance.band_id?.id ?? null,
      started_at: performance.started_at,
      ended_at: performance.ended_at,
      duration_seconds: performance.duration_seconds,

      songs_count: performance.songs_count,
      unique_songs_count: this.countUniqueSongs(performance),
      songs: performance.songs.map((song) => ({
        ...PerformanceOutputMapper.songToOutput(song),
        tips_during_song: this.countTipsInWindow(
          tipTimes,
          song.started_at,
          song.ended_at ?? performance.ended_at!,
        ),
      })),

      requests_received: requests.length,
      requests_accepted: requests.filter((r) => r.status.isAccepted()).length,
      requests_rejected: requests.filter((r) => r.status.isRejected()).length,
      requests_played: requests.filter((r) => r.status.isPlayed()).length,

      tips_count: tips.length,
      tips_total: this.round2(
        tips.reduce((acc, t) => acc + t.amount.amount, 0),
      ),

      attendees_count: attendees.length,
      setlist,

      tips_attribution_note:
        "A gorjeta por música é estimada por proximidade de horário, não por indicação do público.",
    };
  }

  private async loadRequests(performance: Performance) {
    const result = await this.requestRepo.search(
      RequestSearchParams.create({
        page: 1,
        per_page: REQUESTS_PAGE_SIZE,
        filter: {
          event_id: performance.event_id.id,
          musician_id: performance.musician_id.id,
        },
      }),
    );
    return result.items;
  }

  /**
   * Só gorjeta CONFIRMADA (`completed`) entra no relatório.
   *
   * Somar `pending` mostraria ao músico um total que ainda pode não acontecer —
   * e é o número que ele confere contra a carteira. Divergência aí destrói a
   * confiança em toda a tela.
   */
  private async loadPaidTips(performance: Performance) {
    const result = await this.tipRepo.search(
      new TipSearchParams({
        page: 1,
        per_page: TIPS_PAGE_SIZE,
        filter: {
          event_id: performance.event_id.id,
          status: TipStatus.COMPLETED,
        },
      }),
    );

    // O filtro do repositório não distingue destinatário, e um evento tem mais
    // de um artista. Sem esta narrowing o relatório somaria a gorjeta que o
    // público deu para OUTRO músico do mesmo show.
    //
    // Show de banda: a gorjeta chega em `band_id`, não em `musician_id` — por
    // isso os dois lados entram na comparação.
    return result.items.filter((tip) => {
      const toMusician = tip.musician_id?.id === performance.musician_id.id;
      const toBand =
        !!performance.band_id && tip.band_id?.id === performance.band_id.id;
      return toMusician || toBand;
    });
  }

  private async loadSetlistCoverage(
    performance: Performance,
  ): Promise<GetPerformanceReportOutput["setlist"]> {
    if (!performance.repertoire_id || !this.repertoireRepo) return null;
    const repertoire = await this.repertoireRepo.findById(
      new RepertoireId(performance.repertoire_id.id),
    );
    if (!repertoire) return null;

    const planned = new Set(repertoire.songs.map((song) => song.music_library_id));
    const played = new Set(
      performance.songs
        .map((song) => song.music_library_id)
        .filter((id): id is string => !!id && planned.has(id)),
    );
    return { planned_count: planned.size, played_count: played.size };
  }

  private countUniqueSongs(performance: Performance): number {
    const keys = new Set(
      performance.songs.map(
        (s) =>
          s.music_library_id ??
          `${s.title.toLowerCase()}::${s.artist.toLowerCase()}`,
      ),
    );
    return keys.size;
  }

  private countTipsInWindow(tipTimes: number[], from: Date, to: Date): number {
    // A janela se estende um pouco além do fim da música: gorjeta é enviada
    // logo DEPOIS de ouvir, não durante. Estender antes do início seria pior —
    // roubaria a gorjeta da música anterior.
    const start = from.getTime();
    const end = to.getTime() + TIP_ATTRIBUTION_WINDOW_MS;
    return tipTimes.filter((t) => t >= start && t <= end).length;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
