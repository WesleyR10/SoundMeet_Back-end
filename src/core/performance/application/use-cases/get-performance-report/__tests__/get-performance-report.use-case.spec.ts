import { ForbiddenException } from "@nestjs/common";

import { Establishment } from "../../../../../establishment/domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../../../establishment/infra/db/in-memory/establishment-in-memory.repository";
import { EventAttendee } from "../../../../../events/domain/event-attendee.aggregate";
import { EventAttendeeInMemoryRepository } from "../../../../../events/infra/db/in-memory/event-attendee-in-memory.repository";
import { Tip } from "../../../../../payment/domain/tip.aggregate";
import { PaymentMethod } from "../../../../../payment/domain/tip-enums";
import { TipInMemoryRepository } from "../../../../../payment/infra/db/in-memory/tip-in-memory.repository";
import { Request } from "../../../../../request/domain/request.aggregate";
import { RequestInMemoryRepository } from "../../../../../request/infra/db/in-memory/request-in-memory.repository";
import { Repertoire, RepertoireSong } from "../../../../../repertoire/domain/repertoire.aggregate";
import { RepertoireInMemoryRepository } from "../../../../../repertoire/infra/db/in-memory/repertoire-in-memory.repository";
import { Uuid } from "../../../../../shared/domain";
import { Performance } from "../../../../domain/performance.aggregate";
import { PerformanceInMemoryRepository } from "../../../../infra/db/in-memory/performance-in-memory.repository";
import { GetPerformanceReportUseCase } from "../get-performance-report.use-case";

describe("GetPerformanceReportUseCase", () => {
  let performanceRepo: PerformanceInMemoryRepository;
  let requestRepo: RequestInMemoryRepository;
  let tipRepo: TipInMemoryRepository;
  let attendeeRepo: EventAttendeeInMemoryRepository;
  let establishmentRepo: EstablishmentInMemoryRepository;
  let establishment: Establishment;
  let useCase: GetPerformanceReportUseCase;

  const musicianId = new Uuid().id;
  const eventId = new Uuid().id;
  const showStart = new Date("2026-08-21T22:00:00.000Z");

  beforeEach(async () => {
    performanceRepo = new PerformanceInMemoryRepository();
    requestRepo = new RequestInMemoryRepository();
    tipRepo = new TipInMemoryRepository();
    attendeeRepo = new EventAttendeeInMemoryRepository();
    establishmentRepo = new EstablishmentInMemoryRepository();
    useCase = new GetPerformanceReportUseCase(
      performanceRepo,
      requestRepo,
      tipRepo,
      attendeeRepo,
      establishmentRepo,
    );

    establishment = Establishment.fake()
      .anEstablishment()
      .withName("Bar do Zé")
      .build();
    await establishmentRepo.insert(establishment);
  });

  async function anEndedShow(songTitles: string[] = ["A", "B", "C"]) {
    const performance = Performance.create({
      event_id: eventId,
      establishment_id: establishment.establishment_id.id,
      musician_id: musicianId,
      started_at: showStart,
    });

    songTitles.forEach((title, i) => {
      performance.startSong({
        title,
        artist: "Artista",
        started_at: new Date(showStart.getTime() + i * 240_000),
      });
    });

    performance.endPerformance(
      new Date(showStart.getTime() + songTitles.length * 240_000),
    );
    await performanceRepo.insert(performance);
    return performance;
  }

  async function aPaidTip(amount: number, at: Date, target = musicianId) {
    const tip = Tip.create({
      audience_id: new Uuid().id,
      musician_id: target,
      event_id: eventId,
      amount,
      payment_method: PaymentMethod.PIX,
    });
    tip.complete(new Uuid().id);
    // `created_at` é o eixo da janela de atribuição; o fake precisa controlá-lo.
    (tip as unknown as { created_at: Date }).created_at = at;
    await tipRepo.insert(tip);
    return tip;
  }

  it("conta músicas, pedidos, gorjetas e público", async () => {
    const performance = await anEndedShow(["A", "B", "C"]);

    const accepted = Request.create({
      event_id: eventId,
      audience_id: new Uuid().id,
      musician_id: musicianId,
      song_title: "Pedida",
    });
    accepted.accept();
    await requestRepo.insert(accepted);

    const rejected = Request.create({
      event_id: eventId,
      audience_id: new Uuid().id,
      musician_id: musicianId,
      song_title: "Recusada",
    });
    rejected.reject("fora do repertório");
    await requestRepo.insert(rejected);

    await aPaidTip(20, new Date(showStart.getTime() + 60_000));
    await aPaidTip(30.5, new Date(showStart.getTime() + 300_000));

    await attendeeRepo.insert(
      EventAttendee.create({ event_id: eventId, audience_id: new Uuid().id }),
    );
    await attendeeRepo.insert(
      EventAttendee.create({ event_id: eventId, audience_id: new Uuid().id }),
    );

    const report = await useCase.execute({
      performance_id: performance.performance_id.id,
      requesting_musician_id: musicianId,
    });

    expect(report.songs_count).toBe(3);
    expect(report.requests_received).toBe(2);
    expect(report.requests_accepted).toBe(1);
    expect(report.requests_rejected).toBe(1);
    expect(report.tips_count).toBe(2);
    expect(report.tips_total).toBe(50.5);
    expect(report.attendees_count).toBe(2);
  });

  it("resolve o nome da casa para o card compartilhável", async () => {
    const performance = await anEndedShow(["A"]);

    const report = await useCase.execute({
      performance_id: performance.performance_id.id,
      requesting_musician_id: musicianId,
    });

    expect(report.establishment_name).toBe("Bar do Zé");
  });

  it("devolve establishment_name nulo quando a casa não existe mais", async () => {
    const performance = Performance.create({
      event_id: eventId,
      // Estabelecimento que nunca foi inserido no repositório — simula a casa
      // removida depois do show.
      establishment_id: new Uuid().id,
      musician_id: musicianId,
      started_at: showStart,
    });
    performance.startSong({ title: "A", artist: "Artista" });
    performance.endPerformance(new Date(showStart.getTime() + 240_000));
    await performanceRepo.insert(performance);

    const report = await useCase.execute({
      performance_id: performance.performance_id.id,
      requesting_musician_id: musicianId,
    });

    // Nulo, nunca "Local desconhecido": o card omite a linha em vez de
    // escrever um placeholder que parece dado.
    expect(report.establishment_name).toBeNull();
    expect(report.songs_count).toBe(1);
  });

  it("conta bis uma vez em unique_songs_count e duas em songs_count", async () => {
    const performance = await anEndedShow([
      "Evidências",
      "Outra",
      "Evidências",
    ]);

    const report = await useCase.execute({
      performance_id: performance.performance_id.id,
      requesting_musician_id: musicianId,
    });

    expect(report.songs_count).toBe(3);
    expect(report.unique_songs_count).toBe(2);
  });

  it("ignora gorjeta destinada a OUTRO músico do mesmo evento", async () => {
    const performance = await anEndedShow(["A"]);
    await aPaidTip(100, new Date(showStart.getTime() + 60_000), new Uuid().id);

    const report = await useCase.execute({
      performance_id: performance.performance_id.id,
      requesting_musician_id: musicianId,
    });

    expect(report.tips_count).toBe(0);
    expect(report.tips_total).toBe(0);
  });

  it("ignora gorjeta ainda não confirmada", async () => {
    const performance = await anEndedShow(["A"]);
    const pending = Tip.create({
      audience_id: new Uuid().id,
      musician_id: musicianId,
      event_id: eventId,
      amount: 999,
      payment_method: PaymentMethod.PIX,
    });
    await tipRepo.insert(pending);

    const report = await useCase.execute({
      performance_id: performance.performance_id.id,
      requesting_musician_id: musicianId,
    });

    // Somar `pending` mostraria um total que ainda pode não acontecer, e é o
    // número que o músico confere contra a carteira.
    expect(report.tips_total).toBe(0);
  });

  it("rotula a atribuição de gorjeta por música como aproximação", async () => {
    const performance = await anEndedShow(["A"]);
    await aPaidTip(10, new Date(showStart.getTime() + 30_000));

    const report = await useCase.execute({
      performance_id: performance.performance_id.id,
      requesting_musician_id: musicianId,
    });

    expect(report.songs[0].tips_during_song).toBe(1);
    // A nota viaja com o dado em vez de depender de o front lembrar dela.
    expect(report.tips_attribution_note).toMatch(/estimada/i);
  });

  it("recusa relatório de show em andamento", async () => {
    const live = Performance.create({
      event_id: eventId,
      establishment_id: new Uuid().id,
      musician_id: musicianId,
    });
    live.startSong({ title: "Tocando", artist: "A" });
    await performanceRepo.insert(live);

    await expect(
      useCase.execute({
        performance_id: live.performance_id.id,
        requesting_musician_id: musicianId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("recusa relatório de set alheio", async () => {
    const performance = await anEndedShow(["A"]);

    await expect(
      useCase.execute({
        performance_id: performance.performance_id.id,
        requesting_musician_id: new Uuid().id,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe("setlist programada (plano × execução)", () => {
    it("conta músicas DISTINTAS da setlist que foram tocadas — bis não infla, avulsa não entra", async () => {
      const repertoireRepo = new RepertoireInMemoryRepository();
      const withSetlist = new GetPerformanceReportUseCase(
        performanceRepo, requestRepo, tipRepo, attendeeRepo, establishmentRepo, repertoireRepo,
      );
      const [a, b, c, avulsa] = [new Uuid().id, new Uuid().id, new Uuid().id, new Uuid().id];
      const setlist = Repertoire.create({ musician_id: musicianId, name: "Sexta" });
      [a, b, c].forEach((id) => setlist.addSong(RepertoireSong.create({ music_library_id: id })));
      await repertoireRepo.insert(setlist);

      const performance = Performance.create({
        event_id: eventId,
        establishment_id: establishment.establishment_id.id,
        musician_id: musicianId,
        repertoire_id: setlist.repertoire_id.id,
        started_at: showStart,
      });
      [a, avulsa, a].forEach((id, i) => performance.startSong({
        title: `M${i}`, artist: "X", music_library_id: id,
        started_at: new Date(showStart.getTime() + i * 240_000),
      }));
      performance.endPerformance(new Date(showStart.getTime() + 3 * 240_000));
      await performanceRepo.insert(performance);

      const report = await withSetlist.execute({
        performance_id: performance.performance_id.id,
        requesting_musician_id: musicianId,
      });

      expect(report.setlist).toEqual({ planned_count: 3, played_count: 1 });
    });

    it("show sem setlist devolve null, nunca '0 de 0'", async () => {
      const performance = await anEndedShow();
      const report = await useCase.execute({
        performance_id: performance.performance_id.id,
        requesting_musician_id: musicianId,
      });
      expect(report.setlist).toBeNull();
    });
  });
});
