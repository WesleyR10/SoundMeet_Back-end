import { Establishment } from "../../../../../establishment/domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../../../establishment/infra/db/in-memory/establishment-in-memory.repository";
import { Event } from "../../../../../events/domain/event.aggregate";
import { EventMusician } from "../../../../../events/domain/event-musician.aggregate";
import { EventInMemoryRepository } from "../../../../../events/infra/db/in-memory/event-in-memory.repository";
import { EventMusicianInMemoryRepository } from "../../../../../events/infra/db/in-memory/event-musician-in-memory.repository";
import { Band } from "../../../../../musician/domain/band.aggregate";
import { Musician } from "../../../../../musician/domain/musician.aggregate";
import { BandInMemoryRepository } from "../../../../../musician/infra/db/in-memory/band-in-memory.repository";
import { MusicianInMemoryRepository } from "../../../../../musician/infra/db/in-memory/musician-in-memory.repository";
import { Uuid } from "../../../../../shared/domain";
import { Performance } from "../../../../domain/performance.aggregate";
import { PerformanceInMemoryRepository } from "../../../../infra/db/in-memory/performance-in-memory.repository";
import { ListStagesUseCase } from "../list-stages.use-case";

const NOW = new Date("2026-09-28T22:00:00.000Z");
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

describe("ListStagesUseCase", () => {
  let eventRepo: EventInMemoryRepository;
  let eventMusicianRepo: EventMusicianInMemoryRepository;
  let establishmentRepo: EstablishmentInMemoryRepository;
  let musicianRepo: MusicianInMemoryRepository;
  let bandRepo: BandInMemoryRepository;
  let performanceRepo: PerformanceInMemoryRepository;
  let useCase: ListStagesUseCase;

  beforeEach(() => {
    establishmentRepo = new EstablishmentInMemoryRepository();
    eventRepo = new EventInMemoryRepository(establishmentRepo);
    eventMusicianRepo = new EventMusicianInMemoryRepository();
    musicianRepo = new MusicianInMemoryRepository();
    bandRepo = new BandInMemoryRepository();
    performanceRepo = new PerformanceInMemoryRepository();
    useCase = new ListStagesUseCase(
      eventRepo,
      eventMusicianRepo,
      establishmentRepo,
      musicianRepo,
      bandRepo,
      performanceRepo,
    );
  });

  async function venue(name = "Bar do Zé") {
    const establishment = Establishment.fake().anEstablishment().withName(name).build();
    await establishmentRepo.insert(establishment);
    return establishment;
  }

  async function show(
    establishment: Establishment,
    props: { name: string; start: Date; end: Date; status?: "scheduled" | "active" | "completed" | "cancelled"; isPublic?: boolean; attendees?: number },
  ) {
    const event = Event.fake()
      .anEvent()
      .withEstablishmentId(new Uuid(establishment.establishment_id.id))
      .withName(props.name)
      .withStartAt(props.start)
      .withEndAt(props.end)
      .withStatus(props.status ?? "active")
      .withIsPublic(props.isPublic ?? true)
      .withCurrentCapacity(props.attendees ?? 0)
      .build();
    await eventRepo.insert(event);
    return event;
  }

  async function artist(stageName: string) {
    const musician = Musician.fake().aMusician().withStageName(stageName).build();
    await musicianRepo.insert(musician);
    return musician;
  }

  async function book(event: Event, act: { musician?: Musician; band?: Band }, status: "confirmed" | "pending" | "cancelled" = "confirmed") {
    await eventMusicianRepo.insert(
      EventMusician.fake()
        .anEventMusician()
        .withEventId(new Uuid(event.event_id.id))
        .withMusicianId(act.musician ? new Uuid(act.musician.musician_id.id) : null)
        .withBandId(act.band ? new Uuid(act.band.band_id.id) : null)
        .withStatus(status)
        .build(),
    );
  }

  async function openSet(event: Event, establishment: Establishment, musician: Musician, songs: string[], bandId?: string) {
    const performance = Performance.create({
      event_id: event.event_id.id,
      establishment_id: establishment.establishment_id.id,
      musician_id: musician.musician_id.id,
      band_id: bandId ?? null,
    });
    songs.forEach((title) => performance.startSong({ title, artist: "Artista" }));
    await performanceRepo.insert(performance);
    return performance;
  }

  it("ao vivo: devolve o show em andamento com casa, line-up e a música do momento", async () => {
    const bar = await venue("Bar do Zé");
    const sarau = await show(bar, { name: "Sarau", start: hours(-1), end: hours(4), attendees: 12 });
    const joao = await artist("João Blues");
    await book(sarau, { musician: joao });
    await openSet(sarau, bar, joao, ["Wonderwall", "Evidências"]);

    const output = await useCase.execute({ window: "live", now: NOW });

    expect(output.stages).toHaveLength(1);
    const stage = output.stages[0];
    expect(stage.venue.name).toBe("Bar do Zé");
    expect(stage.attendees_count).toBe(12);
    expect(stage.lineup).toEqual([
      expect.objectContaining({
        name: "João Blues",
        is_on_stage: true,
        songs_count: 2,
        now_playing: { title: "Evidências", artist: "Artista", spotify_url: null },
      }),
    ]);
  });

  it("show começado ONTEM que ainda não terminou continua ao vivo", async () => {
    // O filtro do repositório olha `start_at`: sem a folga para trás, o show
    // que atravessa a meia-noite sumiria no minuto em que é o mais importante.
    const bar = await venue();
    await show(bar, { name: "Virada", start: hours(-5), end: hours(1) });

    const output = await useCase.execute({ window: "live", now: NOW });

    expect(output.stages.map((s) => s.name)).toEqual(["Virada"]);
  });

  it("ao vivo é o RELÓGIO: show já terminado mas ainda `active` não aparece", async () => {
    // O job de auto-finalização roda a cada 10 min; nessa janela o status
    // ainda diz `active` e o fã seria mandado a uma casa vazia.
    const bar = await venue();
    await show(bar, { name: "Acabou", start: hours(-4), end: hours(-0.1), status: "active" });

    const output = await useCase.execute({ window: "live", now: NOW });

    expect(output.stages).toEqual([]);
  });

  it("cancelado, encerrado e privado nunca sobem ao cartaz", async () => {
    const bar = await venue();
    await show(bar, { name: "Cancelado", start: hours(-1), end: hours(3), status: "cancelled" });
    await show(bar, { name: "Encerrado", start: hours(-1), end: hours(3), status: "completed" });
    await show(bar, { name: "Privado", start: hours(-1), end: hours(3), isPublic: false });

    const output = await useCase.execute({ window: "live", now: NOW });

    expect(output.stages).toEqual([]);
  });

  it("só escalação CONFIRMADA entra no line-up — e nunca expõe cachê", async () => {
    const bar = await venue();
    const sarau = await show(bar, { name: "Sarau", start: hours(-1), end: hours(3) });
    await book(sarau, { musician: await artist("Confirmado") }, "confirmed");
    await book(sarau, { musician: await artist("Pendente") }, "pending");
    await book(sarau, { musician: await artist("Saiu") }, "cancelled");

    const output = await useCase.execute({ window: "live", now: NOW });

    const lineup = output.stages[0].lineup;
    expect(lineup.map((p) => p.name)).toEqual(["Confirmado"]);
    expect(Object.keys(lineup[0])).not.toContain("fee");
  });

  it("banda: o set aberto pelo músico em nome da banda acende a BANDA", async () => {
    const bar = await venue();
    const jazz = await show(bar, { name: "Jazz", start: hours(-1), end: hours(3) });
    const leader = await artist("Líder");
    const band = Band.fake().aBand().withName("Carlão Trio").build();
    await bandRepo.insert(band);
    await book(jazz, { band });
    await openSet(jazz, bar, leader, ["So What"], band.band_id.id);

    const output = await useCase.execute({ window: "live", now: NOW });

    expect(output.stages[0].lineup).toEqual([
      expect.objectContaining({ name: "Carlão Trio", band_id: band.band_id.id, musician_id: null, is_on_stage: true }),
    ]);
  });

  it("palco com set aberto vem antes do palco ainda sem ninguém tocando", async () => {
    const quiet = await show(await venue("Quieto"), { name: "Sem set", start: hours(-2), end: hours(3), attendees: 80 });
    const bar = await venue("Tocando");
    const loud = await show(bar, { name: "Com set", start: hours(-1), end: hours(3), attendees: 5 });
    const joao = await artist("João");
    await book(loud, { musician: joao });
    await book(quiet, { musician: await artist("Maria") });
    await openSet(loud, bar, joao, ["Primeira"]);

    const output = await useCase.execute({ window: "live", now: NOW });

    expect(output.stages.map((s) => s.name)).toEqual(["Com set", "Sem set"]);
  });

  it("próximos: só o que começa depois de agora, em ordem de horário, sem 'tocando agora'", async () => {
    const bar = await venue();
    await show(bar, { name: "Sábado", start: hours(48), end: hours(52), status: "scheduled" });
    await show(bar, { name: "Hoje mais tarde", start: hours(2), end: hours(6), status: "scheduled" });
    await show(bar, { name: "Mês que vem", start: hours(24 * 30), end: hours(24 * 30 + 4), status: "scheduled" });
    await show(bar, { name: "Agora", start: hours(-1), end: hours(3) });

    const output = await useCase.execute({ window: "upcoming", now: NOW });

    expect(output.stages.map((s) => s.name)).toEqual(["Hoje mais tarde", "Sábado"]);
    expect(output.stages.every((s) => s.lineup.every((p) => !p.is_on_stage))).toBe(true);
  });

  it("casa desativada some do cartaz — cartão sem casa não diz ao fã para onde ir", async () => {
    const bar = await venue();
    bar.deactivate();
    await establishmentRepo.update(bar);
    await show(bar, { name: "Sarau", start: hours(-1), end: hours(3) });

    const output = await useCase.execute({ window: "live", now: NOW });

    expect(output.stages).toEqual([]);
  });

  it("com lat/lng SEM raio: calcula distância e ordena, mas não filtra", async () => {
    // Um raio que não pega nenhum palco deixaria a Home vazia — ordenar por
    // proximidade sem cortar é o que o app usa por padrão.
    const near = Establishment.fake().anEstablishment().withName("Esquina").build();
    const far = Establishment.fake().anEstablishment().withName("Longe").build();
    // Só a localização importa aqui; o VO completo exige rua/CEP que o teste não lê.
    near.profile = { location: { latitude: -23.55, longitude: -46.65 } } as any;
    far.profile = { location: { latitude: -22.91, longitude: -43.18 } } as any;
    await establishmentRepo.bulkInsert([near, far]);
    const joao = await artist("João");
    const lapa = await show(far, { name: "Set aberto no Rio", start: hours(-1), end: hours(3) });
    await book(lapa, { musician: joao });
    await openSet(lapa, far, joao, ["Samba"]);
    await show(near, { name: "Esquina sem set", start: hours(-1), end: hours(3) });

    const output = await useCase.execute({ window: "live", now: NOW, lat: -23.56, lng: -46.66 });

    // Os dois aparecem; o perto vem primeiro mesmo sem set aberto.
    expect(output.stages.map((s) => s.name)).toEqual(["Esquina sem set", "Set aberto no Rio"]);
    expect(output.stages[0].venue.distance_km).toBeLessThan(5);
    expect(output.stages[1].venue.distance_km).toBeGreaterThan(300);
  });

  it("sem coordenadas do fã a distância é null, nunca zero", async () => {
    const bar = await venue();
    await show(bar, { name: "Sarau", start: hours(-1), end: hours(3) });

    const output = await useCase.execute({ window: "live", now: NOW, lat: -23.5, lng: null });

    expect(output.stages[0].venue.distance_km).toBeNull();
  });

  it("respeita o teto de cartões", async () => {
    const bar = await venue();
    for (let i = 0; i < 25; i++) {
      await show(bar, { name: `Show ${i}`, start: hours(1 + i), end: hours(3 + i), status: "scheduled" });
    }

    const output = await useCase.execute({ window: "upcoming", now: NOW, limit: 999 });

    expect(output.stages).toHaveLength(20);
  });
});
