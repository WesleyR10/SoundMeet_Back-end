import { MusicLibrary } from "../../../../../music-library/domain/music-library.aggregate";
import { MusicLibraryInMemoryRepository } from "../../../../../music-library/infra/db/in-memory/music-library-in-memory.repository";
import { Request } from "../../../../../request/domain/request.aggregate";
import { RequestInMemoryRepository } from "../../../../../request/infra/db/in-memory/request-in-memory.repository";
import { Uuid } from "../../../../../shared/domain";
import { Performance } from "../../../../domain/performance.aggregate";
import { PerformanceInMemoryRepository } from "../../../../infra/db/in-memory/performance-in-memory.repository";
import { SuggestSetlistUseCase } from "../suggest-setlist.use-case";

describe("SuggestSetlistUseCase", () => {
  let performanceRepo: PerformanceInMemoryRepository;
  let requestRepo: RequestInMemoryRepository;
  let libraryRepo: MusicLibraryInMemoryRepository;
  let useCase: SuggestSetlistUseCase;

  const musicianId = new Uuid().id;
  const establishmentId = new Uuid().id;
  const otherEstablishmentId = new Uuid().id;

  beforeEach(() => {
    performanceRepo = new PerformanceInMemoryRepository();
    requestRepo = new RequestInMemoryRepository();
    libraryRepo = new MusicLibraryInMemoryRepository();
    useCase = new SuggestSetlistUseCase(
      performanceRepo,
      requestRepo,
      libraryRepo,
    );
  });

  async function anEndedShowAt(
    establishment_id: string,
    songs: string[],
    event_id = new Uuid().id,
  ) {
    const performance = Performance.create({
      event_id,
      establishment_id,
      musician_id: musicianId,
    });
    songs.forEach((title) =>
      performance.startSong({ title, artist: "Artista" }),
    );
    performance.endPerformance();
    await performanceRepo.insert(performance);
    return performance;
  }

  it("sem histórico nenhum, cai no repertório e avisa que não há evidência", async () => {
    await libraryRepo.insert(
      MusicLibrary.create({
        musician_id: musicianId,
        title: "Wave",
        artist: "Tom Jobim",
      }),
    );

    const output = await useCase.execute({
      musician_id: musicianId,
      establishment_id: establishmentId,
    });

    expect(output.suggestions).toHaveLength(1);
    expect(output.suggestions[0].evidence[0].reason).toBe(
      "in_repertoire_never_played_here",
    );
    // Zero sinais reais: a UI precisa dizer isso em vez de fingir insight.
    expect(output.evidence_count).toBe(0);
  });

  it("põe o que já foi tocado ALI acima do repertório nunca tocado", async () => {
    await anEndedShowAt(establishmentId, ["Tocada aqui"]);
    await libraryRepo.insert(
      MusicLibrary.create({
        musician_id: musicianId,
        title: "Nunca tocada",
        artist: "X",
      }),
    );

    const output = await useCase.execute({
      musician_id: musicianId,
      establishment_id: establishmentId,
    });

    expect(output.suggestions[0].title).toBe("Tocada aqui");
    expect(output.suggestions[0].score).toBeGreaterThan(0);
    expect(output.suggestions[1].score).toBe(0);
    expect(output.evidence_count).toBe(1);
  });

  it("ignora o que foi tocado em OUTRO local", async () => {
    // O que enche um bar de sertanejo esvazia um de jazz — uma média geral
    // entregaria a sugestão errada para os dois.
    await anEndedShowAt(otherEstablishmentId, ["Sucesso em outro bar"]);

    const output = await useCase.execute({
      musician_id: musicianId,
      establishment_id: establishmentId,
    });

    expect(output.evidence_count).toBe(0);
    expect(output.suggestions).toHaveLength(0);
  });

  it("pedido tocado pesa mais que pedido só aceito", async () => {
    const eventId = new Uuid().id;
    await anEndedShowAt(establishmentId, ["qualquer"], eventId);

    const played = Request.create({
      event_id: eventId,
      audience_id: new Uuid().id,
      musician_id: musicianId,
      song_title: "Muito pedida",
      artist: "A",
    });
    played.accept();
    played.markAsPlayed();
    await requestRepo.insert(played);

    const accepted = Request.create({
      event_id: eventId,
      audience_id: new Uuid().id,
      musician_id: musicianId,
      song_title: "Só aceita",
      artist: "A",
    });
    accepted.accept();
    await requestRepo.insert(accepted);

    const output = await useCase.execute({
      musician_id: musicianId,
      establishment_id: establishmentId,
    });

    const playedSuggestion = output.suggestions.find(
      (s) => s.title === "Muito pedida",
    )!;
    const acceptedSuggestion = output.suggestions.find(
      (s) => s.title === "Só aceita",
    )!;

    expect(playedSuggestion.score).toBeGreaterThan(acceptedSuggestion.score);
  });

  it("acumula sinais da mesma música em vez de duplicar a sugestão", async () => {
    const eventId = new Uuid().id;
    await anEndedShowAt(establishmentId, ["Evidências"], eventId);

    const request = Request.create({
      event_id: eventId,
      audience_id: new Uuid().id,
      musician_id: musicianId,
      song_title: "evidências", // caixa diferente de propósito
      artist: "Artista",
    });
    await requestRepo.insert(request);

    const output = await useCase.execute({
      musician_id: musicianId,
      establishment_id: establishmentId,
    });

    // Sem normalizar caixa, as duas competiriam e nenhuma acumularia sinal
    // suficiente para subir.
    expect(output.suggestions).toHaveLength(1);
    expect(output.suggestions[0].evidence.length).toBeGreaterThan(1);
  });

  it("toda sugestão carrega evidência exibível", async () => {
    const eventId = new Uuid().id;
    await anEndedShowAt(establishmentId, ["A", "B"], eventId);
    await libraryRepo.insert(
      MusicLibrary.create({
        musician_id: musicianId,
        title: "C",
        artist: "Artista",
      }),
    );

    const output = await useCase.execute({
      musician_id: musicianId,
      establishment_id: establishmentId,
    });

    // Sugestão sem evidência é palpite: o músico tem de poder discordar do
    // motivo, não só do resultado.
    for (const suggestion of output.suggestions) {
      expect(suggestion.evidence.length).toBeGreaterThan(0);
      expect(suggestion.evidence[0].reason).toBeTruthy();
    }
  });

  it("respeita o limite", async () => {
    await anEndedShowAt(
      establishmentId,
      Array.from({ length: 10 }, (_, i) => `Música ${i}`),
    );

    const output = await useCase.execute({
      musician_id: musicianId,
      establishment_id: establishmentId,
      limit: 3,
    });

    expect(output.suggestions).toHaveLength(3);
  });

  it("não sugere a biblioteca de outro músico", async () => {
    await libraryRepo.insert(
      MusicLibrary.create({
        musician_id: new Uuid().id,
        title: "Alheia",
        artist: "X",
      }),
    );

    const output = await useCase.execute({
      musician_id: musicianId,
      establishment_id: establishmentId,
    });

    expect(output.suggestions).toHaveLength(0);
  });
});
