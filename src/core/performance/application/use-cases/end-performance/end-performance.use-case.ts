import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  Performance,
  PerformanceId,
} from "../../../domain/performance.aggregate";
import { IPerformanceRepository } from "../../../domain/performance.repository";
import {
  PerformanceOutput,
  PerformanceOutputMapper,
} from "../common/performance-output";

export type EndPerformanceInput = {
  performance_id: string;
  /** Do JWT. */
  requesting_musician_id: string;
};

export type EndPerformanceOutput = PerformanceOutput;

/**
 * Encerra o set e fecha a música em aberto.
 *
 * A partir daqui o relatório pós-show (F6) existe, e o Play Mode volta a ser
 * privado.
 */
export class EndPerformanceUseCase implements IUseCase<
  EndPerformanceInput,
  EndPerformanceOutput
> {
  constructor(
    private readonly performanceRepo: IPerformanceRepository,
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: EndPerformanceInput): Promise<EndPerformanceOutput> {
    const performance = await this.performanceRepo.findById(
      new PerformanceId(input.performance_id),
    );

    if (!performance) {
      throw new NotFoundError(input.performance_id, Performance);
    }

    if (!performance.isOwnedBy(input.requesting_musician_id)) {
      throw new ForbiddenException("Este set não é seu.");
    }

    // Idempotente pelo próprio agregado: set já encerrado devolve o mesmo
    // estado. Encerrar duas vezes é o caso normal de um botão tocado com rede
    // ruim, não um erro do usuário.
    const wasAlreadyEnded = performance.status.isEnded();

    performance.endPerformance();

    if (performance.notification.hasErrors()) {
      throw new EntityValidationError(performance.notification.toJSON());
    }

    if (!wasAlreadyEnded) {
      await this.performanceRepo.update(performance);
      await this.domainEventMediator?.publish(performance);
    }

    return PerformanceOutputMapper.toOutput(performance);
  }
}
