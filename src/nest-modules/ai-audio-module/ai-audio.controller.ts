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

import { GetAiAudioSeparationJobUseCase } from "../../core/ai-audio/application/use-cases/get-ai-audio-separation-job/get-ai-audio-separation-job.use-case";
import { RequestAiAudioSeparationUseCase } from "../../core/ai-audio/application/use-cases/request-ai-audio-separation/request-ai-audio-separation.use-case";
import { UpdateAiAudioSeparationJobProgressUseCase } from "../../core/ai-audio/application/use-cases/update-ai-audio-separation-job-progress/update-ai-audio-separation-job-progress.use-case";
import { SkipThrottle } from "@nestjs/throttler";

import {
  AuthGuard,
  AuthenticatedUser,
  CurrentUser,
  CurrentUserContextGuard,
  InternalToken,
  InternalTokenGuard,
  Roles,
  RolesGuard,
} from "../auth-module";
import { AiAudioSeparationJobPresenter } from "./ai-audio.presenter";
import { RequestAiAudioSeparationDto } from "./dto/request-ai-audio-separation.dto";
import { UpdateAiAudioSeparationJobProgressDto } from "./dto/update-ai-audio-separation-job-progress.dto";

@ApiTags("AI Audio")
@ApiBearerAuth("JWT-auth")
@Controller("ai-audio")
export class AiAudioController {
  @Inject(RequestAiAudioSeparationUseCase)
  private requestSeparationUseCase: RequestAiAudioSeparationUseCase;

  @Inject(GetAiAudioSeparationJobUseCase)
  private getJobUseCase: GetAiAudioSeparationJobUseCase;

  @Inject(UpdateAiAudioSeparationJobProgressUseCase)
  private updateJobProgressUseCase: UpdateAiAudioSeparationJobProgressUseCase;

  @Post("uploads/:id/separations")
  @UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Solicitar separação de áudio",
    description:
      "Cria um job de separação e inicia o processamento assíncrono via HTTP. Músico só pode solicitar separação nos próprios uploads.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: AiAudioSeparationJobPresenter })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async requestSeparation(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: RequestAiAudioSeparationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const output = await this.requestSeparationUseCase.execute({
      ...dto,
      ai_audio_upload_id: id,
      requesting_musician_id: currentUser.userId,
      is_admin: currentUser.isAdmin,
    });
    return new AiAudioSeparationJobPresenter(output);
  }

  @Get("separations/:id")
  @UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Consultar status da separação",
    description:
      "Retorna o job com status e lista de stems (quando concluído). Músico só pode consultar os próprios jobs.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: AiAudioSeparationJobPresenter })
  @ApiResponse({ status: 403, description: "Acesso negado" })
  async getSeparation(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const output = await this.getJobUseCase.execute({
      id,
      requesting_musician_id: currentUser.userId,
      is_admin: currentUser.isAdmin,
    });
    return new AiAudioSeparationJobPresenter(output);
  }

  @Post("internal/separations/:id/progress")
  @SkipThrottle()
  @UseGuards(InternalTokenGuard)
  @InternalToken({
    envKey: "AI_AUDIO_PROGRESS_TOKEN",
    headerName: "x-ai-audio-progress-token",
  })
  @ApiOperation({
    summary: "Atualizar progresso da separação",
    description:
      "Endpoint interno para o serviço de separação enviar progresso e outputs parciais.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  async updateSeparationProgress(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: UpdateAiAudioSeparationJobProgressDto,
  ) {
    await this.updateJobProgressUseCase.execute({
      id,
      ...dto,
    });

    return;
  }
}
