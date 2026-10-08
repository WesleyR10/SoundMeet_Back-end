import { IUseCase } from "../../../../shared/application/use-case.interface";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { Performance } from "../../../domain/performance.aggregate";
import { IPerformanceRepository } from "../../../domain/performance.repository";
import { PerformanceEligibilityService } from "../../services/performance-eligibility.service";
import { PerformanceSetlistService } from "../../services/performance-setlist.service";
import {
  PerformanceOutput,
  PerformanceOutputMapper,
} from "../common/performance-output";

export type StartPerformanceInput = {
  event_id: string;
  /** Quem opera o set. Resolvido do JWT pelo controller, nunca do corpo. */
  musician_id: string;
  band_id?: string | null;
  /** Setlist programada — um repertório do próprio músico. Opcional. */
  repertoire_id?: string | null;
};

export type StartPerformanceOutput = PerformanceOutput;

/**
 * Abre o set — o interruptor que separa ensaio de show.
 *
 * Enquanto não existe set aberto, o Play Mode continua sendo o que sempre foi:
 * privado e silencioso. É a partir daqui que o que o músico toca vira histórico
 * e chega ao fã.
 */
export class StartPerformanceUseCase implements IUseCase<
  StartPerformanceInput,
  StartPerformanceOutput
> {
  constructor(
    private readonly performanceRepo: IPerformanceRepository,
    private readonly eligibility: PerformanceEligibilityService,
    private readonly setlist: PerformanceSetlistService,
    /** Publica `PerformanceStartedEvent` ("começou agora" para seguidores). */
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: StartPerformanceInput): Promise<StartPerformanceOutput> {
    const { establishment_id } = await this.eligibility.assertCanOpenSet({
      event_id: input.event_id,
      musician_id: input.musician_id,
      band_id: input.band_id ?? null,
    });

    // A posse é checada ANTES da idempotência: um retry com repertório alheio
    // não pode passar só porque o set já existe.
    if (input.repertoire_id) {
      await this.setlist.assertOwnedBy(input.repertoire_id, input.musician_id);
    }

    // Idempotente: reabrir devolve o set que já está no ar em vez de 409.
    //
    // Não é conveniência — é a única resposta correta. O app do músico abre o
    // set no palco, muitas vezes com rede ruim; um retry depois de um timeout
    // que na verdade tinha funcionado esbarraria no índice parcial único e
    // devolveria erro numa ação que deu certo, com o músico olhando para a
    // tela no meio do show.
    const existing = await this.performanceRepo.findLiveByEventAndMusician({
      event_id: input.event_id,
      musician_id: input.musician_id,
    });

    if (existing) {
      return PerformanceOutputMapper.toOutput(existing);
    }

    const performance = Performance.create({
      event_id: input.event_id,
      establishment_id,
      musician_id: input.musician_id,
      band_id: input.band_id ?? null,
      repertoire_id: input.repertoire_id ?? null,
    });

    await this.performanceRepo.insert(performance);
    // Depois do insert: avisar seguidores de um set que não foi gravado
    // mandaria gente a um palco que o sistema não conhece.
    await this.domainEventMediator?.publish(performance);

    return PerformanceOutputMapper.toOutput(performance);
  }
}
