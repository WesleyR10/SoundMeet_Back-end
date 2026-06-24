import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { CompleteAiCifraAnalysisJobUseCase } from "../../core/ai-cifra/application/use-cases/complete-ai-cifra-analysis-job/complete-ai-cifra-analysis-job.use-case";
import { FailAiCifraAnalysisJobUseCase } from "../../core/ai-cifra/application/use-cases/fail-ai-cifra-analysis-job/fail-ai-cifra-analysis-job.use-case";
import { GetAiCifraAnalysisJobUseCase } from "../../core/ai-cifra/application/use-cases/get-ai-cifra-analysis-job/get-ai-cifra-analysis-job.use-case";
import { RequestAiCifraAnalysisUseCase } from "../../core/ai-cifra/application/use-cases/request-ai-cifra-analysis/request-ai-cifra-analysis.use-case";
import { UpdateAiCifraAnalysisJobProgressUseCase } from "../../core/ai-cifra/application/use-cases/update-ai-cifra-analysis-job-progress/update-ai-cifra-analysis-job-progress.use-case";
import { SkipThrottle } from "@nestjs/throttler";

import {
  AuthGuard,
  InternalToken,
  InternalTokenGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { AiCifraAnalysisJobPresenter } from "./ai-cifra.presenter";
import { CompleteAiCifraAnalysisJobDto } from "./dto/complete-ai-cifra-analysis-job.dto";
import { FailAiCifraAnalysisJobDto } from "./dto/fail-ai-cifra-analysis-job.dto";
import { RequestAiCifraAnalysisDto } from "./dto/request-ai-cifra-analysis.dto";
import { UpdateAiCifraAnalysisJobProgressDto } from "./dto/update-ai-cifra-analysis-job-progress.dto";

@ApiTags("AI Cifra")
@ApiBearerAuth("JWT-auth")
@Controller("ai-cifra")
export class AiCifraController {
  @Inject(RequestAiCifraAnalysisUseCase)
  private requestAnalysisUseCase: RequestAiCifraAnalysisUseCase;

  @Inject(GetAiCifraAnalysisJobUseCase)
  private getJobUseCase: GetAiCifraAnalysisJobUseCase;

  @Inject(UpdateAiCifraAnalysisJobProgressUseCase)
  private updateJobProgressUseCase: UpdateAiCifraAnalysisJobProgressUseCase;

  @Inject(CompleteAiCifraAnalysisJobUseCase)
  private completeJobUseCase: CompleteAiCifraAnalysisJobUseCase;

  @Inject(FailAiCifraAnalysisJobUseCase)
  private failJobUseCase: FailAiCifraAnalysisJobUseCase;

  @Post("uploads/:id/analyses")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Solicitar análise de cifra",
    description:
      "Cria um job de análise (BPM/tempo, acordes, tom, segmentação) e inicia o processamento assíncrono.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: AiCifraAnalysisJobPresenter })
  async requestAnalysis(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: RequestAiCifraAnalysisDto,
  ) {
    const output = await this.requestAnalysisUseCase.execute({
      ...dto,
      ai_cifra_upload_id: id,
    });
    return new AiCifraAnalysisJobPresenter(output);
  }

  @Get("analyses/:id")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Consultar status da análise de cifra",
    description: "Retorna o job com status e resultado (quando concluído).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: AiCifraAnalysisJobPresenter })
  async getAnalysis(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getJobUseCase.execute({ id });
    return new AiCifraAnalysisJobPresenter(output);
  }

  @Post("internal/analyses/:id/progress")
  @SkipThrottle()
  @UseGuards(InternalTokenGuard)
  @InternalToken({
    envKey: "AI_CIFRA_PROGRESS_TOKEN",
    headerName: "x-ai-cifra-progress-token",
  })
  @ApiOperation({
    summary: "Atualizar progresso da análise de cifra",
    description: "Endpoint interno para o worker enviar progresso.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  async updateProgress(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: UpdateAiCifraAnalysisJobProgressDto,
  ) {
    await this.updateJobProgressUseCase.execute({
      id,
      ...dto,
    });
    return;
  }

  @Post("internal/analyses/:id/complete")
  @SkipThrottle()
  @UseGuards(InternalTokenGuard)
  @InternalToken({
    envKey: "AI_CIFRA_PROGRESS_TOKEN",
    headerName: "x-ai-cifra-progress-token",
  })
  @ApiOperation({
    summary: "Completar análise de cifra",
    description:
      "Endpoint interno para o worker concluir o job com resultados.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  async complete(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: CompleteAiCifraAnalysisJobDto,
  ) {
    await this.completeJobUseCase.execute({
      job_id: id,
      ...dto,
    });
    return;
  }

  @Post("internal/analyses/:id/fail")
  @SkipThrottle()
  @UseGuards(InternalTokenGuard)
  @InternalToken({
    envKey: "AI_CIFRA_PROGRESS_TOKEN",
    headerName: "x-ai-cifra-progress-token",
  })
  @ApiOperation({
    summary: "Marcar análise de cifra como falha",
    description: "Endpoint interno para o worker reportar falhas do job.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  async fail(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: FailAiCifraAnalysisJobDto,
  ) {
    await this.failJobUseCase.execute({
      job_id: id,
      error_code: dto.error_code,
      error_message: dto.error_message,
    });
    return;
  }
}
