import { ForbiddenException } from "@nestjs/common";

import { MusicLibrary } from "../../../../../music-library/domain/music-library.aggregate";
import { MusicLibraryInMemoryRepository } from "../../../../../music-library/infra/db/in-memory/music-library-in-memory.repository";
import { Request } from "../../../../../request/domain/request.aggregate";
import { RequestInMemoryRepository } from "../../../../../request/infra/db/in-memory/request-in-memory.repository";
import { Uuid } from "../../../../../shared/domain";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Performance } from "../../../../domain/performance.aggregate";
import { PerformanceInMemoryRepository } from "../../../../infra/db/in-memory/performance-in-memory.repository";
import { StartSongUseCase } from "../start-song.use-case";

describe("StartSongUseCase", () => {
  let performanceRepo: PerformanceInMemoryRepository;
  let libraryRepo: MusicLibraryInMemoryRepository;
  let requestRepo: RequestInMemoryRepository;
  let useCase: StartSongUseCase;

  const musicianId = new Uuid().id;
  const otherMusicianId = new Uuid().id;
  const eventId = new Uuid().id;
  let performance: Performance;

  beforeEach(async () => {
    performanceRepo = new PerformanceInMemoryRepository();
    libraryRepo = new MusicLibraryInMemoryRepository();
    requestRepo = new RequestInMemoryRepository();
    useCase = new StartSongUseCase(performanceRepo, libraryRepo, requestRepo);

    performance = Performance.create({
      event_id: eventId,
      establishment_id: new Uuid().id,
      musician_id: musicianId,
    });
    await performanceRepo.insert(performance);
  });

  describe("posse", () => {
    it("recusa quem não é dono do set", async () => {
      await expect(
        useCase.execute({
          performance_id: performance.performance_id.id,
          requesting_musician_id: otherMusicianId,
          title: "A",
          artist: "1",
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("404 em set inexistente", async () => {
      await expect(
        useCase.execute({
          performance_id: new Uuid().id,
          requesting_musician_id: musicianId,
          title: "A",
          artist: "1",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("resolução do título e artista", () => {
    it("usa título e artista livres quando não há origem", async () => {
      const output = await useCase.execute({
        performance_id: performance.performance_id.id,
        requesting_musician_id: musicianId,
        title: "Improviso",
        artist: "Autoral",
      });

      expect(output.current_song?.title).toBe("Improviso");
      expect(output.current_song?.artist).toBe("Autoral");
    });

    it("tira o snapshot da biblioteca quando music_library_id é dado", async () => {
      const song = MusicLibrary.create({
        musician_id: musicianId,
        title: "Wave",
        artist: "Tom Jobim",
      });
      await libraryRepo.insert(song);

      const output = await useCase.execute({
        performance_id: performance.performance_id.id,
        requesting_musician_id: musicianId,
        music_library_id: song.music_library_id.id,
        // Texto conflitante no corpo é IGNORADO: a biblioteca tem precedência.
        title: "Título mentiroso",
        artist: "Artista mentiroso",
      });

      expect(output.current_song?.title).toBe("Wave");
      expect(output.current_song?.artist).toBe("Tom Jobim");
      expect(output.current_song?.music_library_id).toBe(
        song.music_library_id.id,
      );
    });

    it("recusa música da biblioteca de outro músico", async () => {
      const alheia = MusicLibrary.create({
        musician_id: otherMusicianId,
        title: "Não é minha",
        artist: "X",
      });
      await libraryRepo.insert(alheia);

      await expect(
        useCase.execute({
          performance_id: performance.performance_id.id,
          requesting_musician_id: musicianId,
          music_library_id: alheia.music_library_id.id,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("pedido do público", () => {
    function aRequest(
      overrides: Partial<{ musician_id: string; event_id: string }> = {},
    ) {
      return Request.create({
        event_id: overrides.event_id ?? eventId,
        audience_id: new Uuid().id,
        musician_id: overrides.musician_id ?? musicianId,
        song_title: "Sozinho",
        artist: "Caetano Veloso",
      });
    }

    it("tira o snapshot do pedido", async () => {
      const request = aRequest();
      await requestRepo.insert(request);

      const output = await useCase.execute({
        performance_id: performance.performance_id.id,
        requesting_musician_id: musicianId,
        request_id: request.request_id.id,
      });

      expect(output.current_song?.title).toBe("Sozinho");
      expect(output.current_song?.artist).toBe("Caetano Veloso");
      expect(output.current_song?.request_id).toBe(request.request_id.id);
    });

    it("recusa pedido de outro músico", async () => {
      const request = aRequest({ musician_id: otherMusicianId });
      await requestRepo.insert(request);

      await expect(
        useCase.execute({
          performance_id: performance.performance_id.id,
          requesting_musician_id: musicianId,
          request_id: request.request_id.id,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("recusa pedido de outro evento", async () => {
      // Sem esta checagem o endpoint marcaria como tocado o pedido de um show
      // alheio — e daria ao fã de outro evento os pontos de bônus.
      const request = aRequest({ event_id: new Uuid().id });
      await requestRepo.insert(request);

      await expect(
        useCase.execute({
          performance_id: performance.performance_id.id,
          requesting_musician_id: musicianId,
          request_id: request.request_id.id,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("persistência", () => {
    it("grava o set atualizado, não só o agregado em memória", async () => {
      await useCase.execute({
        performance_id: performance.performance_id.id,
        requesting_musician_id: musicianId,
        title: "A",
        artist: "1",
      });

      const reloaded = await performanceRepo.findById(
        performance.performance_id,
      );
      expect(reloaded!.songs_count).toBe(1);
    });
  });
});
