import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  Performance,
  PerformanceId,
} from "../../../domain/performance.aggregate";
import { IPerformanceRepository } from "../../../domain/performance.repository";
import { PerformanceSetlistService } from "../../services/performance-setlist.service";
import {
  PerformanceOutput,
  PerformanceOutputMapper,
} from "../common/performance-output";

export type ChangePerformanceSetlistInput = {
  performance_id: string;
  /** Do JWT. */
  requesting_musician_id: string;
  /** `null` remove a setlist — o show segue no improviso. */
  repertoire_id: string | null;
};

/**
 * Troca a setlist com o set no ar.
 *
 * Existe porque o plano muda no palco: a casa pede outro clima, o músico
 * esqueceu de escolher ao subir. Obrigar a encerrar e reabrir o set para isso
 * partiria o show em dois relatórios.
 */
export class ChangePerformanceSetlistUseCase implements IUseCase<
  ChangePerformanceSetlistInput,
  PerformanceOutput
> {
  constructor(
    private readonly performanceRepo: IPerformanceRepository,
    private readonly setlist: PerformanceSetlistService,
  ) {}

  async execute(input: ChangePerformanceSetlistInput): Promise<PerformanceOutput> {
    const performance = await this.performanceRepo.findById(
      new PerformanceId(input.performance_id),
    );

    if (!performance) {
      throw new NotFoundError(input.performance_id, Performance);
    }

    if (!performance.isOwnedBy(input.requesting_musician_id)) {
      throw new ForbiddenException("Este set não é seu.");
    }

    if (input.repertoire_id) {
      await this.setlist.assertOwnedBy(input.repertoire_id, input.requesting_musician_id);
    }

    performance.changeSetlist(input.repertoire_id);

    if (performance.notification.hasErrors()) {
      throw new EntityValidationError(performance.notification.toJSON());
    }

    await this.performanceRepo.update(performance);

    return PerformanceOutputMapper.toOutput(performance);
  }
}
