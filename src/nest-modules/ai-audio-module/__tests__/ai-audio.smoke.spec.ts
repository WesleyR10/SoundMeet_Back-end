import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";

import { CompleteAiAudioSeparationJobUseCase } from "../../../core/ai-audio/application/use-cases/complete-ai-audio-separation-job/complete-ai-audio-separation-job.use-case";
import { CreateAiAudioUploadUseCase } from "../../../core/ai-audio/application/use-cases/create-ai-audio-upload/create-ai-audio-upload.use-case";
import { FailAiAudioSeparationJobUseCase } from "../../../core/ai-audio/application/use-cases/fail-ai-audio-separation-job/fail-ai-audio-separation-job.use-case";
import { GetAiAudioSeparationJobUseCase } from "../../../core/ai-audio/application/use-cases/get-ai-audio-separation-job/get-ai-audio-separation-job.use-case";
import { ProcessAiAudioSeparationJobUseCase } from "../../../core/ai-audio/application/use-cases/process-ai-audio-separation-job/process-ai-audio-separation-job.use-case";
import { RequestAiAudioSeparationUseCase } from "../../../core/ai-audio/application/use-cases/request-ai-audio-separation/request-ai-audio-separation.use-case";
import { UpdateAiAudioSeparationJobProgressUseCase } from "../../../core/ai-audio/application/use-cases/update-ai-audio-separation-job-progress/update-ai-audio-separation-job-progress.use-case";
import { PrismaService } from "../../database-module/prisma/prisma.service";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import { AiAudioController } from "../ai-audio.controller";
import { AI_AUDIO_PROVIDERS } from "../ai-audio.providers";

describe("AiAudioModule — Smoke Test (DI wiring)", () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await applyAuthGuardMocks(
      Test.createTestingModule({
        controllers: [AiAudioController],
        providers: [
          ...Object.values(AI_AUDIO_PROVIDERS.REPOSITORIES),
          ...Object.values(AI_AUDIO_PROVIDERS.INFRA_PROVIDERS),
          ...Object.values(AI_AUDIO_PROVIDERS.USE_CASES),
          {
            provide: PrismaService,
            useValue: {},
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const defaults: Record<string, unknown> = {
                  AI_AUDIO_PROCESSING_TRANSPORT: "http",
                  AI_AUDIO_PROCESSING_CONCURRENCY: 1,
                  AI_AUDIO_MAX_FILE_SIZE: 100 * 1024 * 1024,
                  AI_AUDIO_ALLOWED_MIME_TYPES: "audio/mpeg,audio/wav",
                  AI_AUDIO_DEFAULT_MODEL_ID: "htdemucs_4stems",
                  AI_AUDIO_STORAGE_PROVIDER: undefined,
                  AWS_REGION: "us-east-1",
                  AWS_S3_BUCKET: "test-bucket",
                };
                return defaults[key];
              }),
            },
          },
        ],
      }),
    ).compile();
  });

  afterAll(async () => {
    await module.close();
  });

  it("deve resolver AiAudioController sem erro de DI", () => {
    expect(module.get(AiAudioController)).toBeDefined();
  });

  it("deve resolver CreateAiAudioUploadUseCase", () => {
    expect(module.get(CreateAiAudioUploadUseCase)).toBeInstanceOf(
      CreateAiAudioUploadUseCase,
    );
  });

  it("deve resolver RequestAiAudioSeparationUseCase", () => {
    expect(module.get(RequestAiAudioSeparationUseCase)).toBeInstanceOf(
      RequestAiAudioSeparationUseCase,
    );
  });

  it("deve resolver ProcessAiAudioSeparationJobUseCase", () => {
    expect(module.get(ProcessAiAudioSeparationJobUseCase)).toBeInstanceOf(
      ProcessAiAudioSeparationJobUseCase,
    );
  });

  it("deve resolver CompleteAiAudioSeparationJobUseCase", () => {
    expect(module.get(CompleteAiAudioSeparationJobUseCase)).toBeInstanceOf(
      CompleteAiAudioSeparationJobUseCase,
    );
  });

  it("deve resolver FailAiAudioSeparationJobUseCase", () => {
    expect(module.get(FailAiAudioSeparationJobUseCase)).toBeInstanceOf(
      FailAiAudioSeparationJobUseCase,
    );
  });

  it("deve resolver GetAiAudioSeparationJobUseCase", () => {
    expect(module.get(GetAiAudioSeparationJobUseCase)).toBeInstanceOf(
      GetAiAudioSeparationJobUseCase,
    );
  });

  it("deve resolver UpdateAiAudioSeparationJobProgressUseCase", () => {
    expect(
      module.get(UpdateAiAudioSeparationJobProgressUseCase),
    ).toBeInstanceOf(UpdateAiAudioSeparationJobProgressUseCase);
  });
});
