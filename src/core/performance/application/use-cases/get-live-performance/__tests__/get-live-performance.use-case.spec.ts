import { Uuid } from "../../../../../shared/domain";
import { Performance } from "../../../../domain/performance.aggregate";
import { PerformanceInMemoryRepository } from "../../../../infra/db/in-memory/performance-in-memory.repository";
import { GetLivePerformanceUseCase } from "../get-live-performance.use-case";

describe("GetLivePerformanceUseCase", () => {
  let repo: PerformanceInMemoryRepository;
  let useCase: GetLivePerformanceUseCase;

  const eventId = new Uuid().id;
  const musicianId = new Uuid().id;

  beforeEach(() => {
    repo = new PerformanceInMemoryRepository();
    useCase = new GetLivePerformanceUseCase(repo);
  });

  it("sem set aberto responde is_live: false, nunca 404", async () => {
    // Ninguém tocando é estado legítimo (intervalo, show que não começou). Um
    // 404 obrigaria o app a tratar erro no caminho feliz e piscaria falha na
    // tela do fã.
    const output = await useCase.execute({
      event_id: eventId,
      musician_id: musicianId,
    });

    expect(output.is_live).toBe(false);
    expect(output.current_song).toBeNull();
    expect(output.performance_id).toBeNull();
  });

  it("devolve a música do momento", async () => {
    const performance = Performance.create({
      event_id: eventId,
      establishment_id: new Uuid().id,
      musician_id: musicianId,
    });
    performance.startSong({ title: "Primeira", artist: "A" });
    performance.startSong({ title: "Tocando agora", artist: "B" });
    await repo.insert(performance);

    const output = await useCase.execute({
      event_id: eventId,
      musician_id: musicianId,
    });

    expect(output.is_live).toBe(true);
    expect(output.current_song?.title).toBe("Tocando agora");
    expect(output.songs_count).toBe(2);
  });

  it("acompanha a troca de música — é o que o fã vê ao avançar o show", async () => {
    const performance = Performance.create({
      event_id: eventId,
      establishment_id: new Uuid().id,
      musician_id: musicianId,
    });
    performance.startSong({ title: "Música 1", artist: "A" });
    await repo.insert(performance);

    const before = await useCase.execute({
      event_id: eventId,
      musician_id: musicianId,
    });
    expect(before.current_song?.title).toBe("Música 1");

    performance.startSong({ title: "Música 2", artist: "A" });
    await repo.update(performance);

    const after = await useCase.execute({
      event_id: eventId,
      musician_id: musicianId,
    });
    expect(after.current_song?.title).toBe("Música 2");
  });

  it("entre uma música e outra, is_live continua true com current_song null", async () => {
    const performance = Performance.create({
      event_id: eventId,
      establishment_id: new Uuid().id,
      musician_id: musicianId,
    });
    await repo.insert(performance);

    const output = await useCase.execute({
      event_id: eventId,
      musician_id: musicianId,
    });

    expect(output.is_live).toBe(true);
    expect(output.current_song).toBeNull();
  });

  it("set encerrado não aparece como ao vivo", async () => {
    const performance = Performance.create({
      event_id: eventId,
      establishment_id: new Uuid().id,
      musician_id: musicianId,
    });
    performance.startSong({ title: "A", artist: "1" });
    performance.endPerformance();
    await repo.insert(performance);

    const output = await useCase.execute({
      event_id: eventId,
      musician_id: musicianId,
    });

    expect(output.is_live).toBe(false);
  });

  it("não vaza o set de outro músico no mesmo evento", async () => {
    const other = Performance.create({
      event_id: eventId,
      establishment_id: new Uuid().id,
      musician_id: new Uuid().id,
    });
    other.startSong({ title: "Do outro", artist: "X" });
    await repo.insert(other);

    const output = await useCase.execute({
      event_id: eventId,
      musician_id: musicianId,
    });

    expect(output.is_live).toBe(false);
  });
});
