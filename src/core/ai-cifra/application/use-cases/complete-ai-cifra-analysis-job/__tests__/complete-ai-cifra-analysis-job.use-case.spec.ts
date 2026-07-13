import { UpdateMusicLibraryUseCase } from "../../../../../music-library/application/use-cases/update-music-library/update-music-library.use-case";
import { MusicLibrary } from "../../../../../music-library/domain/music-library.aggregate";
import { MusicLibraryInMemoryRepository } from "../../../../../music-library/infra/db/in-memory/music-library-in-memory.repository";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { AiCifraAnalysisJob } from "../../../../domain/ai-cifra-analysis-job.aggregate";
import { AiCifraUpload } from "../../../../domain/ai-cifra-upload.aggregate";
import { AiCifraAnalysisJobInMemoryRepository } from "../../../../infra/db/in-memory/ai-cifra-analysis-job-in-memory.repository";
import { AiCifraUploadInMemoryRepository } from "../../../../infra/db/in-memory/ai-cifra-upload-in-memory.repository";
import { CompleteAiCifraAnalysisJobUseCase } from "../complete-ai-cifra-analysis-job.use-case";

describe("CompleteAiCifraAnalysisJobUseCase", () => {
  let uploadRepo: AiCifraUploadInMemoryRepository;
  let jobRepo: AiCifraAnalysisJobInMemoryRepository;
  let musicLibraryRepo: MusicLibraryInMemoryRepository;
  let storage: { deleteObject: jest.Mock };

  beforeEach(() => {
    uploadRepo = new AiCifraUploadInMemoryRepository();
    jobRepo = new AiCifraAnalysisJobInMemoryRepository();
    musicLibraryRepo = new MusicLibraryInMemoryRepository();
    storage = { deleteObject: jest.fn().mockResolvedValue(undefined) };
  });

  it("grava bpm/key/chords/segments de volta na MusicLibrary vinculada ao upload", async () => {
    const musicLibrary = MusicLibrary.fake().aMusicLibrary().build();
    await musicLibraryRepo.insert(musicLibrary);

    const upload = AiCifraUpload.create({
      musician_id: musicLibrary.musician_id.id,
      music_library_id: musicLibrary.music_library_id.id,
      original_filename: "song.mp3",
      content_type: "audio/mpeg",
      file_size: 1024,
      object_key: "ai-cifra/x/original.mp3",
      upload_method: "direct",
      status: "analyzing",
    });
    await uploadRepo.insert(upload);

    const job = AiCifraAnalysisJob.create({
      ai_cifra_upload_id: upload.ai_cifra_upload_id.id,
      musician_id: musicLibrary.musician_id.id,
      model_id: "omar_rq_crnn_v1",
      status: "processing",
    });
    await jobRepo.insert(job);

    const updateMusicLibraryUseCase = new UpdateMusicLibraryUseCase(
      musicLibraryRepo,
    );
    const useCase = new CompleteAiCifraAnalysisJobUseCase(
      uploadRepo,
      jobRepo,
      storage as any,
      updateMusicLibraryUseCase,
    );

    await useCase.execute({
      job_id: job.ai_cifra_analysis_job_id.id,
      bpm: 128,
      key: "G",
      chords: [
        { start_seconds: 0, end_seconds: 2, chord: "G", confidence: 0.9 },
      ],
      segments: [
        { start_seconds: 0, end_seconds: 10, label: "Verse", confidence: 0.8 },
      ],
    });

    const updated = await musicLibraryRepo.findById(
      musicLibrary.music_library_id,
    );
    expect(updated?.bpm).toBe(128);
    expect(updated?.key).toBe("G");
    expect(updated?.chords).toEqual([
      { start_seconds: 0, end_seconds: 2, chord: "G", confidence: 0.9 },
    ]);
    expect(updated?.structure_segments).toEqual([
      { start_seconds: 0, end_seconds: 10, label: "Verse", confidence: 0.8 },
    ]);

    const completedJob = await jobRepo.findById(
      job.ai_cifra_analysis_job_id,
    );
    expect(completedJob?.status).toBe("completed");
  });

  it("não quebra a conclusão do job quando o upload não tem music_library_id vinculado", async () => {
    const upload = AiCifraUpload.create({
      musician_id: new Uuid().id,
      music_library_id: null,
      original_filename: "song.mp3",
      content_type: "audio/mpeg",
      file_size: 1024,
      object_key: "ai-cifra/x/original.mp3",
      upload_method: "direct",
      status: "analyzing",
    });
    await uploadRepo.insert(upload);

    const job = AiCifraAnalysisJob.create({
      ai_cifra_upload_id: upload.ai_cifra_upload_id.id,
      musician_id: new Uuid().id,
      model_id: "omar_rq_crnn_v1",
      status: "processing",
    });
    await jobRepo.insert(job);

    const updateMusicLibraryUseCase = new UpdateMusicLibraryUseCase(
      musicLibraryRepo,
    );
    const useCase = new CompleteAiCifraAnalysisJobUseCase(
      uploadRepo,
      jobRepo,
      storage as any,
      updateMusicLibraryUseCase,
    );

    await expect(
      useCase.execute({ job_id: job.ai_cifra_analysis_job_id.id, bpm: 100 }),
    ).resolves.toBeUndefined();

    const completedJob = await jobRepo.findById(
      job.ai_cifra_analysis_job_id,
    );
    expect(completedJob?.status).toBe("completed");
  });
});
