import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  AiCifraAnalysisJob,
  AiCifraAnalysisJobId,
} from "../../../domain/ai-cifra-analysis-job.aggregate";
import { IAiCifraAnalysisJobRepository } from "../../../domain/ai-cifra-analysis-job.repository";
import {
  AiCifraAnalysisJobOutput,
  AiCifraAnalysisJobOutputMapper,
} from "../common/ai-cifra-analysis-job-output";
import { GetAiCifraAnalysisJobInput } from "./get-ai-cifra-analysis-job.input";

export class GetAiCifraAnalysisJobUseCase implements IUseCase<
  GetAiCifraAnalysisJobInput,
  AiCifraAnalysisJobOutput
> {
  constructor(private readonly jobRepo: IAiCifraAnalysisJobRepository) {}

  async execute(
    input: GetAiCifraAnalysisJobInput,
  ): Promise<AiCifraAnalysisJobOutput> {
    const job = await this.jobRepo.findById(new AiCifraAnalysisJobId(input.id));
    if (!job) {
      throw new NotFoundError(input.id, AiCifraAnalysisJob);
    }

    if (input.requesting_musician_id && !input.is_admin) {
      if (job.musician_id.id !== input.requesting_musician_id) {
        throw new ForbiddenException(
          "Você não tem permissão para consultar este job de análise.",
        );
      }
    }

    return AiCifraAnalysisJobOutputMapper.toOutput(job);
  }
}
