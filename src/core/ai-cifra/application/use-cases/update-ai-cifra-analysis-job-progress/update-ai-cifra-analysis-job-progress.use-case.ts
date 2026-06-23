import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import {
  AiCifraAnalysisJob,
  AiCifraAnalysisJobId,
} from "../../../domain/ai-cifra-analysis-job.aggregate";
import { IAiCifraAnalysisJobRepository } from "../../../domain/ai-cifra-analysis-job.repository";
import { UpdateAiCifraAnalysisJobProgressInput } from "./update-ai-cifra-analysis-job-progress.input";

export class UpdateAiCifraAnalysisJobProgressUseCase implements IUseCase<
  UpdateAiCifraAnalysisJobProgressInput,
  void
> {
  constructor(private readonly jobRepo: IAiCifraAnalysisJobRepository) {}

  async execute(input: UpdateAiCifraAnalysisJobProgressInput): Promise<void> {
    const job = await this.jobRepo.findById(new AiCifraAnalysisJobId(input.id));
    if (!job) {
      throw new NotFoundError(input.id, AiCifraAnalysisJob);
    }

    if (job.status === "completed" || job.status === "failed") {
      return;
    }

    job.updateProgress({
      progress_percent: input.progress_percent,
      progress_stage: input.progress_stage,
    });

    await this.jobRepo.update(job);
  }
}
