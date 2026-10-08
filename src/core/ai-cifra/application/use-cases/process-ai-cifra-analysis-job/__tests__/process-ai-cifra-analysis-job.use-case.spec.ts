import { UpdateMusicLibraryUseCase } from "../../../../../music-library/application/use-cases/update-music-library/update-music-library.use-case";
import { MusicLibrary } from "../../../../../music-library/domain/music-library.aggregate";
import { MusicLibraryInMemoryRepository } from "../../../../../music-library/infra/db/in-memory/music-library-in-memory.repository";
import { AiCifraAnalysisJob } from "../../../../domain/ai-cifra-analysis-job.aggregate";
import { AiCifraUpload } from "../../../../domain/ai-cifra-upload.aggregate";
import { AiCifraAnalysisJobInMemoryRepository } from "../../../../infra/db/in-memory/ai-cifra-analysis-job-in-memory.repository";
import { AiCifraUploadInMemoryRepository } from "../../../../infra/db/in-memory/ai-cifra-upload-in-memory.repository";
import { ProcessAiCifraAnalysisJobUseCase } from "../process-ai-cifra-analysis-job.use-case";

describe("ProcessAiCifraAnalysisJobUseCase", () => {
  let uploadRepo: AiCifraUploadInMemoryRepository;
  let jobRepo: AiCifraAnalysisJobInMemoryRepository;
  let musicLibraryRepo: MusicLibraryInMemoryRepository;
  let storage: { deleteObject: jest.Mock };
  let client: { analyze: jest.Mock };

  beforeEach(() => {
    uploadRepo = new AiCifraUploadInMemoryRepository();
    jobRepo = new AiCifraAnalysisJobInMemoryRepository();
    musicLibraryRepo = new MusicLibraryInMemoryRepository();
    storage = { deleteObject: jest.fn().mockResolvedValue(undefined) };
    client = {
      analyze: jest.fn().mockResolvedValue({
        bpm: 128,
        key: "G",
        time_signature: "4/4",
        chords: [
          { start_seconds: 0, end_seconds: 2, chord: "G", confidence: 0.9 },
        ],
        segments: [
          {
            start_seconds: 0,
            end_seconds: 10,
            label: "Verse",
            confidence: 0.8,
          },
        ],
        artifacts: { worker: "chordformer_v22", duration_seconds: 214.5 },
      }),
    };
  });

  // Regressão do achado (jul/2026): este é o caminho SÍNCRONO, o usado por
  // padrão via AI_CIFRA_PROCESSING_TRANSPORT=http (envs/.env.example) --
  // antes desta correção, era o único dos dois caminhos de conclusão de
  // análise que NUNCA escrevia bpm/key/chords/structure_segments de volta em
  // MusicLibrary (o irmão CompleteAiCifraAnalysisJobUseCase já fazia isso
  // desde o item 6.5/roadmap.md). GET .../chord-sheet lê direto de
  // MusicLibrary, não do job -- ou seja, no transport default, completar uma
  // análise nunca preenchia a cifra de verdade.
  it("grava bpm/key/chords/segments de volta na MusicLibrary vinculada ao upload (mesmo caminho síncrono/http default)", async () => {
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
      model_id: "chordformer_v22_phase2",
      status: "queued",
    });
    await jobRepo.insert(job);

    const updateMusicLibraryUseCase = new UpdateMusicLibraryUseCase(
      musicLibraryRepo,
    );
    const useCase = new ProcessAiCifraAnalysisJobUseCase(
      uploadRepo,
      jobRepo,
      client as any,
      storage as any,
      undefined,
      updateMusicLibraryUseCase,
    );

    await useCase.execute({ job_id: job.ai_cifra_analysis_job_id.id });

    const updated = await musicLibraryRepo.findById(
      musicLibrary.music_library_id,
    );
    expect(updated?.bpm).toBe(128);
    expect(updated?.key).toBe("G");
    expect(updated?.duration_seconds).toBe(214.5);
    expect(updated?.chords).toEqual([
      { start_seconds: 0, end_seconds: 2, chord: "G", confidence: 0.9 },
    ]);
    expect(updated?.structure_segments).toEqual([
      { start_seconds: 0, end_seconds: 10, label: "Verse", confidence: 0.8 },
    ]);

    const completedJob = await jobRepo.findById(job.ai_cifra_analysis_job_id);
    expect(completedJob?.status).toBe("completed");
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
  });

  it("chama o alinhamento de letra com o object_key ANTES de apagar o áudio do storage", async () => {
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
      model_id: "chordformer_v22_phase2",
      status: "queued",
    });
    await jobRepo.insert(job);

    const callOrder: string[] = [];
    storage.deleteObject.mockImplementation(async () => {
      callOrder.push("delete");
    });
    const alignSyncedLyricsUseCase = {
      execute: jest.fn().mockImplementation(async () => {
        callOrder.push("align");
      }),
    };

    const useCase = new ProcessAiCifraAnalysisJobUseCase(
      uploadRepo,
      jobRepo,
      client as any,
      storage as any,
      undefined,
      undefined,
      alignSyncedLyricsUseCase,
    );

    await useCase.execute({ job_id: job.ai_cifra_analysis_job_id.id });

    expect(alignSyncedLyricsUseCase.execute).toHaveBeenCalledWith({
      music_library_id: musicLibrary.music_library_id.id,
      audio_object_key: "ai-cifra/x/original.mp3",
    });
    expect(callOrder).toEqual(["align", "delete"]);
  });

  it("não quebra a conclusão do job quando a ponte pro catálogo falha (best-effort)", async () => {
    const upload = AiCifraUpload.create({
      musician_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      music_library_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
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
      musician_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      model_id: "chordformer_v22_phase2",
      status: "queued",
    });
    await jobRepo.insert(job);

    const updateMusicLibraryUseCase = {
      execute: jest
        .fn()
        .mockRejectedValue(new Error("music library not found")),
    };

    const useCase = new ProcessAiCifraAnalysisJobUseCase(
      uploadRepo,
      jobRepo,
      client as any,
      storage as any,
      undefined,
      updateMusicLibraryUseCase as any,
    );

    await expect(
      useCase.execute({ job_id: job.ai_cifra_analysis_job_id.id }),
    ).resolves.toBeUndefined();

    const completedJob = await jobRepo.findById(job.ai_cifra_analysis_job_id);
    expect(completedJob?.status).toBe("completed");
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
  });
});
