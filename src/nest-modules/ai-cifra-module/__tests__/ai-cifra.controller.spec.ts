import { AiCifraController } from "../ai-cifra.controller";
import { AiCifraAnalysisJobPresenter } from "../ai-cifra.presenter";

const now = new Date("2026-06-19T12:00:00.000Z");

function analysisJobOutput(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    ai_cifra_upload_id: "22222222-2222-4222-8222-222222222222",
    musician_id: "33333333-3333-4333-8333-333333333333",
    model_id: "chordformer",
    status: "queued",
    progress_percent: 0,
    progress_stage: null,
    error_code: null,
    error_message: null,
    started_at: null,
    finished_at: null,
    result: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function inject(
  controller: AiCifraController,
  key: string,
  execute = jest.fn(),
) {
  (controller as any)[key] = { execute };
  return execute;
}

describe("AiCifraController Unit Tests", () => {
  let controller: AiCifraController;

  beforeEach(() => {
    controller = new AiCifraController();
  });

  it("should request analysis with upload id from route", async () => {
    const execute = inject(
      controller,
      "requestAnalysisUseCase",
      jest.fn().mockResolvedValue(analysisJobOutput()),
    );

    const presenter = await controller.requestAnalysis(
      "22222222-2222-4222-8222-222222222222",
      {
        musician_id: "33333333-3333-4333-8333-333333333333",
        model_id: "chordformer",
      },
    );

    expect(execute).toHaveBeenCalledWith({
      musician_id: "33333333-3333-4333-8333-333333333333",
      model_id: "chordformer",
      ai_cifra_upload_id: "22222222-2222-4222-8222-222222222222",
    });
    expect(presenter).toBeInstanceOf(AiCifraAnalysisJobPresenter);
  });

  it("should update internal analysis progress", async () => {
    const execute = inject(
      controller,
      "updateJobProgressUseCase",
      jest.fn().mockResolvedValue(undefined),
    );

    await controller.updateProgress("11111111-1111-4111-8111-111111111111", {
      progress_percent: 40,
      progress_stage: "detecting_chords",
    });

    expect(execute).toHaveBeenCalledWith({
      id: "11111111-1111-4111-8111-111111111111",
      progress_percent: 40,
      progress_stage: "detecting_chords",
    });
  });

  it("should complete and fail internal analysis jobs using job_id", async () => {
    const complete = inject(
      controller,
      "completeJobUseCase",
      jest.fn().mockResolvedValue(undefined),
    );
    const fail = inject(
      controller,
      "failJobUseCase",
      jest.fn().mockResolvedValue(undefined),
    );

    await controller.complete("11111111-1111-4111-8111-111111111111", {
      bpm: 120,
      key: "C",
      time_signature: "4/4",
      chords: [],
      segments: [],
      artifacts: null,
    });
    await controller.fail("11111111-1111-4111-8111-111111111111", {
      error_code: "worker_error",
      error_message: "worker failed",
    });

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        job_id: "11111111-1111-4111-8111-111111111111",
        bpm: 120,
      }),
    );
    expect(fail).toHaveBeenCalledWith({
      job_id: "11111111-1111-4111-8111-111111111111",
      error_code: "worker_error",
      error_message: "worker failed",
    });
  });
});
