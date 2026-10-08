import { AiAudioSeparationJob } from "../../../../domain/ai-audio-separation-job.aggregate";
import { AiAudioSeparationOutput } from "../../../../domain/ai-audio-separation-output.child-entity";
import { AiAudioSeparationJobInMemoryRepository } from "../../../../infra/db/in-memory/ai-audio-separation-job-in-memory.repository";
import { IAiAudioStorage } from "../../../ports/ai-audio-storage.interface";
import { PurgeExpiredAiAudioStemsUseCase } from "../purge-expired-ai-audio-stems.use-case";

describe("PurgeExpiredAiAudioStemsUseCase", () => {
  const NOW = new Date("2026-08-22T12:00:00.000Z");

  let repo: AiAudioSeparationJobInMemoryRepository;
  let storage: IAiAudioStorage;
  let useCase: PurgeExpiredAiAudioStemsUseCase;

  beforeEach(() => {
    repo = new AiAudioSeparationJobInMemoryRepository();
    storage = {
      putObject: jest.fn().mockResolvedValue(undefined),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      getPublicUrl: jest.fn().mockReturnValue("https://cdn.test/stem"),
    };
    useCase = new PurgeExpiredAiAudioStemsUseCase(repo, storage, {
      now: () => NOW,
    });
  });

  async function aCompletedJob(expiresAt: Date, stems = ["vocals", "other"]) {
    const job = AiAudioSeparationJob.create({
      ai_audio_upload_id: crypto.randomUUID(),
      musician_id: crypto.randomUUID(),
      model_id: "htdemucs_4stems",
      output_prefix: "ai-audio/out",
    });

    job.complete(
      stems.map(
        (stem_name) =>
          new AiAudioSeparationOutput({
            stem_name,
            object_key: `ai-audio/out/${stem_name}.wav`,
            content_type: "audio/wav",
            file_size: 10,
          }),
      ),
      expiresAt,
    );

    await repo.insert(job);
    return job;
  }

  it("apaga os stems vencidos e marca o job como expired", async () => {
    const job = await aCompletedJob(new Date(NOW.getTime() - 1000));

    const output = await useCase.execute();

    expect(output.jobs_expired).toBe(1);
    expect(output.objects_deleted).toBe(2);
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);

    const reloaded = await repo.findById(job.ai_audio_separation_job_id);
    // `expired`, nunca `failed`: a separação deu certo, o que venceu foi o
    // prazo — e o app precisa da diferença para oferecer "separar de novo".
    expect(reloaded!.status).toBe("expired");
    expect(reloaded!.outputs).toHaveLength(0);
    expect(reloaded!.stems_expire_at).toBeNull();
  });

  it("não toca em job cujo prazo ainda não venceu", async () => {
    await aCompletedJob(new Date(NOW.getTime() + 60 * 60 * 1000));

    const output = await useCase.execute();

    expect(output.jobs_expired).toBe(0);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it("não marca o job quando o storage falha ao apagar", async () => {
    const job = await aCompletedJob(new Date(NOW.getTime() - 1000));
    (storage.deleteObject as jest.Mock).mockRejectedValue(new Error("s3 down"));

    const output = await useCase.execute();

    expect(output.jobs_expired).toBe(0);
    const reloaded = await repo.findById(job.ai_audio_separation_job_id);
    // Marcar assim mesmo perderia o ponteiro para um objeto que continua no
    // bucket: invisível, cobrado, e sem nada apontando para ele.
    expect(reloaded!.status).toBe("completed");
  });
});
