import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { AiAudioSeparationJob } from "../ai-audio-separation-job.aggregate";
import { AiAudioSeparationOutput } from "../ai-audio-separation-output.child-entity";

describe("AiAudioSeparationJob Unit Tests", () => {
  test("should create with default status queued", () => {
    const entity = AiAudioSeparationJob.create({
      ai_audio_upload_id: new Uuid().id,
      musician_id: new Uuid().id,
      model_id: "model",
      output_prefix: "ai-audio/out",
    });

    expect(entity.status).toBe("queued");
    expect(entity.progress_percent).toBe(0);
    expect(entity.progress_stage).toBeNull();
    expect(entity.notification.hasErrors()).toBe(false);
  });

  test("should start/complete", () => {
    const entity = AiAudioSeparationJob.create({
      ai_audio_upload_id: new Uuid().id,
      musician_id: new Uuid().id,
      model_id: "model",
      output_prefix: "ai-audio/out",
    });

    entity.start();
    expect(entity.status).toBe("processing");
    expect(entity.started_at).toBeInstanceOf(Date);
    expect(entity.progress_percent).toBeGreaterThan(0);

    entity.complete([
      new AiAudioSeparationOutput({
        stem_name: "vocals",
        object_key: "ai-audio/vocals.wav",
        content_type: "audio/wav",
        file_size: 1,
      }),
    ]);

    expect(entity.status).toBe("completed");
    expect(entity.progress_percent).toBe(100);
    expect(entity.finished_at).toBeInstanceOf(Date);
    expect(entity.outputs).toHaveLength(1);
  });

  test("should merge outputs on progress updates", () => {
    const entity = AiAudioSeparationJob.create({
      ai_audio_upload_id: new Uuid().id,
      musician_id: new Uuid().id,
      model_id: "model",
      output_prefix: "ai-audio/out",
    });

    entity.start();
    entity.updateProgress({
      progress_percent: 20,
      progress_stage: "uploading",
      outputs: [
        new AiAudioSeparationOutput({
          stem_name: "vocals",
          object_key: "ai-audio/vocals.wav",
          content_type: "audio/wav",
          file_size: 1,
        }),
      ],
    });

    entity.updateProgress({
      progress_percent: 10,
      progress_stage: "uploading",
      outputs: [
        new AiAudioSeparationOutput({
          stem_name: "drums",
          object_key: "ai-audio/drums.wav",
          content_type: "audio/wav",
          file_size: 2,
        }),
      ],
    });

    expect(entity.progress_percent).toBe(20);
    expect(entity.outputs).toHaveLength(2);
    expect(entity.outputs.map((o) => o.stem_name).sort()).toEqual(
      ["drums", "vocals"].sort(),
    );
  });

  test("should fail and requeue", () => {
    const entity = AiAudioSeparationJob.create({
      ai_audio_upload_id: new Uuid().id,
      musician_id: new Uuid().id,
      model_id: "model",
      output_prefix: "ai-audio/out",
    });

    entity.fail("ERR", "failed");
    expect(entity.status).toBe("failed");
    expect(entity.error_code).toBe("ERR");

    entity.requeue("ERR2", "retry");
    expect(entity.status).toBe("queued");
    expect(entity.outputs).toHaveLength(0);
  });
});
