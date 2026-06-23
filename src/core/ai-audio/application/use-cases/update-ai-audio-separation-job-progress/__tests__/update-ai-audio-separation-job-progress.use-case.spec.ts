import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import {
  AiAudioSeparationJob,
  AiAudioSeparationJobId,
} from "../../../../domain/ai-audio-separation-job.aggregate";
import { AiAudioSeparationJobInMemoryRepository } from "../../../../infra/db/in-memory/ai-audio-separation-job-in-memory.repository";
import { UpdateAiAudioSeparationJobProgressUseCase } from "../update-ai-audio-separation-job-progress.use-case";

describe("UpdateAiAudioSeparationJobProgressUseCase Unit Tests", () => {
  test("should update progress and merge outputs", async () => {
    const repo = new AiAudioSeparationJobInMemoryRepository();
    const useCase = new UpdateAiAudioSeparationJobProgressUseCase(repo);

    const job = AiAudioSeparationJob.create({
      ai_audio_upload_id: new Uuid().id,
      musician_id: new Uuid().id,
      model_id: "model",
      output_prefix: "ai-audio/out",
    });
    job.start();

    await repo.insert(job);

    await useCase.execute({
      id: job.ai_audio_separation_job_id.id,
      progress_percent: 20,
      progress_stage: "uploading",
      outputs: [
        {
          stem_name: "vocals",
          object_key: "ai-audio/vocals.wav",
          content_type: "audio/wav",
          file_size: 1,
        },
      ],
    });

    await useCase.execute({
      id: job.ai_audio_separation_job_id.id,
      progress_percent: 10,
      progress_stage: "uploading",
      outputs: [
        {
          stem_name: "drums",
          object_key: "ai-audio/drums.wav",
          content_type: "audio/wav",
          file_size: 2,
        },
      ],
    });

    const updated = await repo.findById(
      new AiAudioSeparationJobId(job.entity_id.id),
    );
    expect(updated).toBeDefined();
    expect(updated!.progress_percent).toBe(20);
    expect(updated!.progress_stage).toBe("uploading");
    expect(updated!.outputs).toHaveLength(2);
    expect(updated!.outputs.map((o) => o.object_key).sort()).toEqual(
      ["ai-audio/drums.wav", "ai-audio/vocals.wav"].sort(),
    );
  });
});
