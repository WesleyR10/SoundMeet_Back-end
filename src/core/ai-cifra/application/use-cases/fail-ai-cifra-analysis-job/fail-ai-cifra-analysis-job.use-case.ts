import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  AiCifraAnalysisJob,
  AiCifraAnalysisJobId,
} from "../../../domain/ai-cifra-analysis-job.aggregate";
import { IAiCifraAnalysisJobRepository } from "../../../domain/ai-cifra-analysis-job.repository";
import { AiCifraUploadId } from "../../../domain/ai-cifra-upload.aggregate";
import { IAiCifraUploadRepository } from "../../../domain/ai-cifra-upload.repository";
import { IAiCifraStorage } from "../../ports/ai-cifra-storage.interface";
import { FailAiCifraAnalysisJobInput } from "./fail-ai-cifra-analysis-job.input";

export class FailAiCifraAnalysisJobUseCase implements IUseCase<
  FailAiCifraAnalysisJobInput,
  void
> {
  constructor(
    private readonly uploadRepo: IAiCifraUploadRepository,
    private readonly jobRepo: IAiCifraAnalysisJobRepository,
    private readonly storage: IAiCifraStorage,
  ) {}

  async execute(input: FailAiCifraAnalysisJobInput): Promise<void> {
    const job = await this.jobRepo.findById(
      new AiCifraAnalysisJobId(input.job_id),
    );
    if (!job) {
      throw new NotFoundError(input.job_id, AiCifraAnalysisJob);
    }

    if (job.status === "completed" || job.status === "failed") {
      return;
    }

    const upload = await this.uploadRepo.findById(
      new AiCifraUploadId(job.ai_cifra_upload_id.id),
    );
    if (!upload) {
      job.fail("UPLOAD_NOT_FOUND", "Upload não encontrado para este job");
      await this.jobRepo.update(job);
      return;
    }

    job.fail(input.error_code, input.error_message);
    if (job.notification.hasErrors()) {
      throw new EntityValidationError(job.notification.toJSON());
    }

    upload.markAnalysisFailed(input.error_message);
    if (upload.notification.hasErrors()) {
      throw new EntityValidationError(upload.notification.toJSON());
    }

    await this.jobRepo.update(job);
    await this.uploadRepo.update(upload);

    await this.storage
      .deleteObject({ object_key: upload.object_key })
      .catch(() => undefined);
  }
}
