import { ForbiddenException } from "@nestjs/common";

import { IEventAttendeeRepository } from "../../../../events/domain/event-attendee.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import {
  Performance,
  PerformanceId,
} from "../../../domain/performance.aggregate";
import { IPerformanceRepository } from "../../../domain/performance.repository";
import {
  PerformanceOutput,
  PerformanceOutputMapper,
} from "../common/performance-output";

export type GetPerformanceInput = {
  performance_id: string;
  /** Do JWT. */
  requesting_musician_id: string;
};

export type GetPerformanceOutput = PerformanceOutput;

/** O set completo — só para o dono. O fã lê `get-live-performance`. */
export class GetPerformanceUseCase implements IUseCase<
  GetPerformanceInput,
  GetPerformanceOutput
> {
  constructor(
    private readonly performanceRepo: IPerformanceRepository,
    private readonly attendeeRepo: IEventAttendeeRepository,
  ) {}

  async execute(input: GetPerformanceInput): Promise<GetPerformanceOutput> {
    const performance = await this.performanceRepo.findById(
      new PerformanceId(input.performance_id),
    );

    if (!performance) {
      throw new NotFoundError(input.performance_id, Performance);
    }

    if (!performance.isOwnedBy(input.requesting_musician_id)) {
      throw new ForbiddenException("Este set não é seu.");
    }

    /*
     * Público presente só com o set NO AR e só aqui — a leitura do dono. É o
     * número que o músico olha no palco ("quantos estão aqui agora?"). Depois
     * de encerrado, quem responde é o relatório, com o mesmo dado.
     *
     * Só a contagem: o nome do fã não sai para o músico por esta rota, pela
     * mesma regra do currículo ("o público alcançado sai só como número").
     */
    const attendees_count = performance.status.isEnded()
      ? null
      : (await this.attendeeRepo.findByEvent(new Uuid(performance.event_id.id))).length;

    return { ...PerformanceOutputMapper.toOutput(performance), attendees_count };
  }
}
