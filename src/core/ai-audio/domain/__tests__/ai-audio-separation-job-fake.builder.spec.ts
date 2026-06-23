import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { AiAudioSeparationJobId } from "../ai-audio-separation-job.aggregate";
import { AiAudioSeparationJobFakeBuilder } from "../ai-audio-separation-job-fake.builder";

describe("AiAudioSeparationJobFakeBuilder Unit Tests", () => {
  test("should build a valid job", () => {
    const job = AiAudioSeparationJobFakeBuilder.aJob().build();
    expect(job.ai_audio_separation_job_id).toBeInstanceOf(
      AiAudioSeparationJobId,
    );
    expect(job.ai_audio_upload_id).toBeInstanceOf(Uuid);
    expect(job.musician_id).toBeInstanceOf(Uuid);
    expect(job.notification.hasErrors()).toBe(false);
  });

  test("should build completed job", () => {
    const job = AiAudioSeparationJobFakeBuilder.aJob().completed().build();
    expect(job.status).toBe("completed");
    expect(job.outputs.length).toBeGreaterThan(0);
  });
});
