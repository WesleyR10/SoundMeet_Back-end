import { ForbiddenException } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  AiCifraAnalysisJob,
  AiCifraAnalysisJobId,
} from "../../../domain/ai-cifra-analysis-job.aggregate";
import { IAiCifraAnalysisJobRepository } from "../../../domain/ai-cifra-analysis-job.repository";
import {
  AiCifraUpload,
  AiCifraUploadId,
} from "../../../domain/ai-cifra-upload.aggregate";
import { IAiCifraUploadRepository } from "../../../domain/ai-cifra-upload.repository";
import { IAiCifraAnalysisDispatcher } from "../../ports/ai-cifra-analysis-dispatcher.interface";
import {
  AiCifraAnalysisJobOutput,
  AiCifraAnalysisJobOutputMapper,
} from "../common/ai-cifra-analysis-job-output";
import { RequestAiCifraAnalysisInput } from "./request-ai-cifra-analysis.input";

export class RequestAiCifraAnalysisUseCase implements IUseCase<
  RequestAiCifraAnalysisInput,
  AiCifraAnalysisJobOutput
> {
  constructor(
    private readonly uploadRepo: IAiCifraUploadRepository,
    private readonly jobRepo: IAiCifraAnalysisJobRepository,
    private readonly dispatcher: IAiCifraAnalysisDispatcher,
    private readonly defaultModelId: string,
    private readonly allowedModelIds: string[],
  ) {}

  async execute(
    input: RequestAiCifraAnalysisInput,
  ): Promise<AiCifraAnalysisJobOutput> {
    const upload = await this.uploadRepo.findById(
      new AiCifraUploadId(input.ai_cifra_upload_id),
    );
    if (!upload) {
      throw new NotFoundError(input.ai_cifra_upload_id, AiCifraUpload);
    }

    if (input.requesting_musician_id && !input.is_admin) {
      if (upload.musician_id.id !== input.requesting_musician_id) {
        throw new ForbiddenException(
          "Você não tem permissão para solicitar análise neste upload.",
        );
      }
    }

    if (upload.status === "rejected") {
      throw new EntityValidationError([
        {
          status: [
            `Upload is rejected: ${upload.rejected_reason ?? "unknown reason"}`,
          ],
        },
      ]);
    }

    const model_id = input.model_id ?? this.defaultModelId;
    const allowed = new Set(
      this.allowedModelIds.map((m) => m.trim()).filter((m) => m.length > 0),
    );
    if (!allowed.has(model_id)) {
      throw new EntityValidationError([
        {
          model_id: [`Model not allowed (${model_id})`],
        },
      ]);
    }

    const jobId = new AiCifraAnalysisJobId();
    const job = AiCifraAnalysisJob.create({
      ai_cifra_analysis_job_id: jobId,
      ai_cifra_upload_id: upload.ai_cifra_upload_id.id,
      musician_id: upload.musician_id.id,
      model_id,
    });

    if (job.notification.hasErrors()) {
      throw new EntityValidationError(job.notification.toJSON());
    }

    upload.markAnalysisQueued();
    if (upload.notification.hasErrors()) {
      throw new EntityValidationError(upload.notification.toJSON());
    }

    await this.uploadRepo.update(upload);
    await this.jobRepo.insert(job);

    await this.dispatcher.enqueue({
      job_id: job.ai_cifra_analysis_job_id.id,
      model_id: job.model_id,
      input_object_key: upload.object_key,
    });

    return AiCifraAnalysisJobOutputMapper.toOutput(job);
  }
}
