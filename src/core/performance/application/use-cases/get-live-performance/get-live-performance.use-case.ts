import { RequestId } from "../../../../request/domain/request.aggregate";
import { IRequestRepository } from "../../../../request/domain/request.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IPerformanceRepository } from "../../../domain/performance.repository";
import { PerformedSongOutput } from "../common/performance-output";
import { PerformanceOutputMapper } from "../common/performance-output";

export type GetLivePerformanceInput = {
  event_id: string;
  musician_id: string;
};

export type GetLivePerformanceOutput = {
  is_live: boolean;
  performance_id: string | null;
  musician_id: string;
  event_id: string;
  /** A música do momento — `null` entre uma e outra, ou sem set aberto. */
  current_song: PerformedSongOutput | null;
  songs_count: number;
  /**
   * Dedicatória do pedido que originou a música tocando agora.
   *
   * 🔴 Esta é a ÚNICA superfície pública da dedicatória, e ela passa pelo
   * portão `Request.publicDedication` — que só devolve texto quando o destaque
   * está `paid`. Ler `boost.dedication` cru aqui publicaria no telão a
   * dedicatória de quem prometeu e nunca pagou.
   *
   * `null` quando a música não veio de pedido, quando o pedido não tinha
   * destaque, ou quando o destaque ainda não foi pago.
   */
  current_song_dedication: string | null;
};

/**
 * "O que está tocando agora?" — a leitura do fã.
 *
 * ## Por que não devolve o set inteiro
 *
 * O fã precisa de UMA música: a que está tocando. Devolver a lista completa
 * entregaria de graça o setlist do músico a qualquer pessoa com o app aberto —
 * e é justamente o repertório que ele monta como diferencial. O relatório
 * completo é do dono do set.
 *
 * ## Por que "sem set" não é 404
 *
 * Ninguém tocando é resposta legítima e frequente: intervalo, show que ainda
 * não começou, músico que esqueceu de abrir o set. Um 404 obrigaria o app a
 * tratar erro no caminho feliz e piscaria mensagem de falha na tela do fã.
 * `is_live: false` é o estado, não a exceção.
 */
export class GetLivePerformanceUseCase implements IUseCase<
  GetLivePerformanceInput,
  GetLivePerformanceOutput
> {
  constructor(
    private readonly performanceRepo: IPerformanceRepository,
    /**
     * Só para a dedicatória. Ausente (chamada interna, teste antigo) devolve
     * `null` — o fã fica sem a dedicatória, nunca com uma que não podia ver.
     */
    private readonly requestRepo?: IRequestRepository,
  ) {}

  async execute(
    input: GetLivePerformanceInput,
  ): Promise<GetLivePerformanceOutput> {
    const performance = await this.performanceRepo.findLiveByEventAndMusician({
      event_id: input.event_id,
      musician_id: input.musician_id,
    });

    if (!performance) {
      return {
        is_live: false,
        performance_id: null,
        musician_id: input.musician_id,
        event_id: input.event_id,
        current_song: null,
        songs_count: 0,
        current_song_dedication: null,
      };
    }

    const current = performance.current_song;

    return {
      is_live: true,
      performance_id: performance.performance_id.id,
      musician_id: performance.musician_id.id,
      event_id: performance.event_id.id,
      current_song: current
        ? PerformanceOutputMapper.songToOutput(current)
        : null,
      songs_count: performance.songs_count,
      current_song_dedication: await this.resolveDedication(
        current?.request_id ?? null,
      ),
    };
  }

  /**
   * A dedicatória que o público pode ver.
   *
   * Lê `publicDedication` (getter do agregado), nunca `boost.dedication`: o
   * portão de "só depois de pago" mora no domínio, e duplicá-lo aqui criaria
   * um segundo lugar onde ele pode ser esquecido.
   */
  private async resolveDedication(
    requestId: string | null,
  ): Promise<string | null> {
    if (!requestId || !this.requestRepo) {
      return null;
    }

    const request = await this.requestRepo.findById(new RequestId(requestId));
    return request?.publicDedication ?? null;
  }
}
