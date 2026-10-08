import { Uuid } from "../../../shared/domain";
import { PerformanceEndedEvent } from "../events/performance-ended.event";
import { SongStartedEvent } from "../events/song-started.event";
import { Performance } from "../performance.aggregate";

function aLiveSet() {
  return Performance.create({
    event_id: new Uuid().id,
    establishment_id: new Uuid().id,
    musician_id: new Uuid().id,
  });
}

describe("Performance aggregate", () => {
  describe("create", () => {
    it("nasce ao vivo, sem músicas e sem fim", () => {
      const performance = aLiveSet();

      expect(performance.status.isLive()).toBe(true);
      expect(performance.ended_at).toBeNull();
      expect(performance.songs).toHaveLength(0);
      expect(performance.current_song).toBeNull();
    });

    it("aceita banda sem deixar de ter um operador", () => {
      const bandId = new Uuid().id;
      const performance = Performance.create({
        event_id: new Uuid().id,
        establishment_id: new Uuid().id,
        musician_id: new Uuid().id,
        band_id: bandId,
      });

      expect(performance.band_id?.id).toBe(bandId);
      // `musician_id` continua sendo quem o guard autoriza.
      expect(performance.musician_id).toBeDefined();
    });
  });

  describe("invariante 1 — uma música por vez", () => {
    it("fecha a anterior ao começar a próxima", () => {
      const performance = aLiveSet();

      performance.startSong({ title: "Primeira", artist: "A" });
      performance.startSong({ title: "Segunda", artist: "B" });

      expect(performance.songs).toHaveLength(2);
      expect(performance.songs[0].ended_at).not.toBeNull();
      expect(performance.songs[0].is_playing).toBe(false);
      expect(performance.songs[1].is_playing).toBe(true);
      expect(performance.current_song?.title).toBe("Segunda");
    });

    it("nunca deixa duas músicas abertas", () => {
      const performance = aLiveSet();

      for (const title of ["Um", "Dois", "Três", "Quatro"]) {
        performance.startSong({ title, artist: "X" });
      }

      expect(performance.songs.filter((s) => s.is_playing)).toHaveLength(1);
    });
  });

  describe("invariante 2 — set encerrado não recebe música", () => {
    it("recusa startSong depois do fim", () => {
      const performance = aLiveSet();
      performance.startSong({ title: "Única", artist: "A" });
      performance.endPerformance();

      const result = performance.startSong({ title: "Tardia", artist: "B" });

      expect(result).toBeNull();
      expect(performance.songs).toHaveLength(1);
      expect(performance.notification.hasErrors()).toBe(true);
    });
  });

  describe("invariante 3 — position é do agregado", () => {
    it("numera a partir de 1, em sequência", () => {
      const performance = aLiveSet();

      performance.startSong({ title: "A", artist: "1" });
      performance.startSong({ title: "B", artist: "2" });
      performance.startSong({ title: "C", artist: "3" });

      expect(performance.songs.map((s) => s.position)).toEqual([1, 2, 3]);
    });
  });

  describe("invariante 5 — o mesmo pedido não toca duas vezes", () => {
    it("recusa request_id repetido", () => {
      const performance = aLiveSet();
      const requestId = new Uuid().id;

      performance.startSong({
        title: "Pedida",
        artist: "A",
        request_id: requestId,
      });
      const second = performance.startSong({
        title: "Pedida de novo",
        artist: "A",
        request_id: requestId,
      });

      expect(second).toBeNull();
      expect(performance.songs).toHaveLength(1);
    });

    it("permite bis — mesma música sem pedido", () => {
      const performance = aLiveSet();

      performance.startSong({ title: "Evidências", artist: "Chitãozinho" });
      const encore = performance.startSong({
        title: "Evidências",
        artist: "Chitãozinho",
      });

      expect(encore).not.toBeNull();
      expect(performance.songs).toHaveLength(2);
    });
  });

  describe("invariante 6 — duração nunca é negativa", () => {
    it("recusa música que começa antes da anterior", () => {
      const performance = aLiveSet();
      const now = new Date("2026-08-21T22:00:00.000Z");

      performance.startSong({ title: "A", artist: "1", started_at: now });
      const result = performance.startSong({
        title: "B",
        artist: "2",
        started_at: new Date(now.getTime() - 60_000),
      });

      expect(result).toBeNull();
      expect(performance.songs).toHaveLength(1);
    });

    it("recusa fim anterior ao início do set", () => {
      const started = new Date("2026-08-21T22:00:00.000Z");
      const performance = Performance.create({
        event_id: new Uuid().id,
        establishment_id: new Uuid().id,
        musician_id: new Uuid().id,
        started_at: started,
      });

      performance.endPerformance(new Date(started.getTime() - 1000));

      expect(performance.status.isLive()).toBe(true);
      expect(performance.notification.hasErrors()).toBe(true);
    });

    it("fecha com duração zero em vez de negativa quando o relógio do cliente atrasa", () => {
      const started = new Date("2026-08-21T22:00:00.000Z");
      const performance = Performance.create({
        event_id: new Uuid().id,
        establishment_id: new Uuid().id,
        musician_id: new Uuid().id,
        started_at: started,
      });

      performance.startSong({
        title: "Última",
        artist: "A",
        started_at: new Date(started.getTime() + 600_000),
      });
      // Fim do set ANTES do início da última música — possível com relógio
      // torto no aparelho.
      performance.endPerformance(new Date(started.getTime() + 60_000));

      expect(performance.songs[0].duration_seconds).toBe(0);
    });
  });

  describe("endPerformance", () => {
    it("fecha a música em aberto e trava o set", () => {
      const performance = aLiveSet();
      performance.startSong({ title: "A", artist: "1" });

      performance.endPerformance();

      expect(performance.status.isEnded()).toBe(true);
      expect(performance.ended_at).not.toBeNull();
      expect(performance.current_song).toBeNull();
      expect(performance.songs[0].ended_at).not.toBeNull();
    });

    it("é idempotente — encerrar duas vezes não muda o fim", () => {
      const performance = aLiveSet();
      performance.endPerformance();
      const firstEnd = performance.ended_at;

      performance.endPerformance();

      expect(performance.ended_at).toEqual(firstEnd);
      expect(performance.notification.hasErrors()).toBe(false);
    });
  });

  describe("eventos de domínio", () => {
    it("emite SongStartedEvent com título e artista já resolvidos", () => {
      const performance = aLiveSet();
      performance.startSong({ title: "Asa Branca", artist: "Luiz Gonzaga" });

      const events = performance.getUncommittedEvents();
      const songStarted = events.find(
        (e): e is SongStartedEvent => e instanceof SongStartedEvent,
      );

      expect(songStarted).toBeDefined();
      // O consumidor não deve precisar voltar à biblioteca para saber o que
      // anunciar — e o par pode nem existir lá.
      expect(songStarted!.title).toBe("Asa Branca");
      expect(songStarted!.artist).toBe("Luiz Gonzaga");
      expect(songStarted!.position).toBe(1);
    });

    it("emite PerformanceEndedEvent com a contagem final", () => {
      const performance = aLiveSet();
      performance.startSong({ title: "A", artist: "1" });
      performance.startSong({ title: "B", artist: "2" });
      performance.endPerformance();

      const ended = performance
        .getUncommittedEvents()
        .find(
          (e): e is PerformanceEndedEvent => e instanceof PerformanceEndedEvent,
        );

      expect(ended).toBeDefined();
      expect(ended!.songs_count).toBe(2);
    });
  });

  describe("validação de entrada", () => {
    it.each([
      ["título vazio", { title: "   ", artist: "A" }],
      ["artista vazio", { title: "A", artist: "" }],
    ])("recusa %s", (_label, command) => {
      const performance = aLiveSet();

      const result = performance.startSong(command);

      expect(result).toBeNull();
      expect(performance.songs).toHaveLength(0);
      expect(performance.notification.hasErrors()).toBe(true);
    });

    it("apara espaços do snapshot", () => {
      const performance = aLiveSet();

      performance.startSong({ title: "  Trem Bala  ", artist: " Ana Vilela " });

      expect(performance.songs[0].title).toBe("Trem Bala");
      expect(performance.songs[0].artist).toBe("Ana Vilela");
    });
  });

  describe("duração", () => {
    it("devolve null para música nunca fechada — não inventa valor", () => {
      const performance = aLiveSet();
      performance.startSong({ title: "A", artist: "1" });

      expect(performance.songs[0].duration_seconds).toBeNull();
      expect(performance.duration_seconds).toBeNull();
    });

    it("calcula em segundos entre início e fim", () => {
      const started = new Date("2026-08-21T22:00:00.000Z");
      const performance = aLiveSet();

      performance.startSong({ title: "A", artist: "1", started_at: started });
      performance.startSong({
        title: "B",
        artist: "2",
        started_at: new Date(started.getTime() + 240_000),
      });

      expect(performance.songs[0].duration_seconds).toBe(240);
    });
  });

  describe("isOwnedBy", () => {
    it("só reconhece o operador do set", () => {
      const musicianId = new Uuid().id;
      const performance = Performance.create({
        event_id: new Uuid().id,
        establishment_id: new Uuid().id,
        musician_id: musicianId,
      });

      expect(performance.isOwnedBy(musicianId)).toBe(true);
      expect(performance.isOwnedBy(new Uuid().id)).toBe(false);
    });
  });

  describe("fake builder", () => {
    it("produz set encerrado coerente", () => {
      const performance = Performance.fake()
        .aPerformance()
        .withPlayedSongs(3)
        .ended()
        .build();

      expect(performance.status.isEnded()).toBe(true);
      expect(performance.songs_count).toBe(3);
      expect(performance.ended_at!.getTime()).toBeGreaterThan(
        performance.started_at.getTime(),
      );
      expect(performance.current_song).toBeNull();
    });
  });
});
