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
    return AiCifraAnalysisJobOutputMapper.toOutput(job);
  }
}
