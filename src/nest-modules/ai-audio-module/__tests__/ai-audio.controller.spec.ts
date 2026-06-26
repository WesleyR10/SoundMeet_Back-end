import { AiAudioController } from "../ai-audio.controller";
import { AiAudioSeparationJobPresenter } from "../ai-audio.presenter";

const now = new Date("2026-06-19T12:00:00.000Z");

function separationJobOutput(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    ai_audio_upload_id: "22222222-2222-4222-8222-222222222222",
    musician_id: "33333333-3333-4333-8333-333333333333",
    model_id: "demucs",
    output_prefix: "ai-audio/outputs",
    output_format: "wav",
    status: "queued",
    progress_percent: 0,
    progress_stage: null,
    error_code: null,
    error_message: null,
    started_at: null,
    finished_at: null,
    outputs: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function inject(
  controller: AiAudioController,
  key: string,
  execute = jest.fn(),
) {
  (controller as any)[key] = { execute };
  return execute;
}

describe("AiAudioController Unit Tests", () => {
  let controller: AiAudioController;

  beforeEach(() => {
    controller = new AiAudioController();
  });

  it("should request separation with upload id from route", async () => {
    const execute = inject(
      controller,
      "requestSeparationUseCase",
      jest.fn().mockResolvedValue(separationJobOutput()),
    );

    const currentUser = {
      userId: "33333333-3333-4333-8333-333333333333",
      roles: ["musician"],
      establishmentIds: [],
      bandIds: [],
      isAdmin: false,
    };

    const presenter = await controller.requestSeparation(
      "22222222-2222-4222-8222-222222222222",
      {
        model_id: "demucs",
        output_format: "wav",
      },
      currentUser,
    );

    expect(execute).toHaveBeenCalledWith({
      model_id: "demucs",
      output_format: "wav",
      ai_audio_upload_id: "22222222-2222-4222-8222-222222222222",
      requesting_musician_id: currentUser.userId,
      is_admin: false,
    });
    expect(presenter).toBeInstanceOf(AiAudioSeparationJobPresenter);
  });

  it("should get separation status by id", async () => {
    const execute = inject(
      controller,
      "getJobUseCase",
      jest
        .fn()
        .mockResolvedValue(separationJobOutput({ status: "processing" })),
    );

    const currentUser = {
      userId: "33333333-3333-4333-8333-333333333333",
      roles: ["musician"],
      establishmentIds: [],
      bandIds: [],
      isAdmin: false,
    };

    const presenter = await controller.getSeparation(
      "11111111-1111-4111-8111-111111111111",
      currentUser,
    );

    expect(execute).toHaveBeenCalledWith({
      id: "11111111-1111-4111-8111-111111111111",
      requesting_musician_id: currentUser.userId,
      is_admin: false,
    });
    expect(presenter.status).toBe("processing");
  });

  it("should update internal separation progress", async () => {
    const execute = inject(
      controller,
      "updateJobProgressUseCase",
      jest.fn().mockResolvedValue(undefined),
    );

    await controller.updateSeparationProgress(
      "11111111-1111-4111-8111-111111111111",
      {
        progress_percent: 55,
        progress_stage: "separating",
        outputs: [],
      },
    );

    expect(execute).toHaveBeenCalledWith({
      id: "11111111-1111-4111-8111-111111111111",
      progress_percent: 55,
      progress_stage: "separating",
      outputs: [],
    });
  });
});
