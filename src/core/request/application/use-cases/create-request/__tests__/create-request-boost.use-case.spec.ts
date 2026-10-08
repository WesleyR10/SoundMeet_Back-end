import { Audience, AudienceId } from "@core/audience/domain";
import { AudienceInMemoryRepository } from "@core/audience/infra/db/in-memory/audience-in-memory.repository";
import { Event, EventId, PresenceVerifier } from "@core/events/domain";
import { EventInMemoryRepository } from "@core/events/infra/db/in-memory";
import { VenueLocationInMemoryAdapter } from "@core/events/infra/venue-location";
import { Musician, MusicianId } from "@core/musician/domain";
import { MusicianInMemoryRepository } from "@core/musician/infra/db/in-memory/musician-in-memory.repository";

import { FakeClock } from "../../../../../shared/application/clock.interface";
import { InvalidOperationError } from "../../../../../shared/domain/errors/invalid-operation.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import {
  BoostChargeCommand,
  BoostChargeResult,
  IBoostChargePort,
} from "../../../../domain/ports/boost-charge.port";
import { RequestId } from "../../../../domain/request.aggregate";
import { RequestBoostStatusEnum } from "../../../../domain/value-objects/request-boost.vo";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { CreateRequestUseCase } from "../create-request.use-case";

const TIP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

class BoostChargeSpy implements IBoostChargePort {
  calls: BoostChargeCommand[] = [];
  failure: Error | null = null;

  async createCharge(command: BoostChargeCommand): Promise<BoostChargeResult> {
    this.calls.push(command);
    if (this.failure) throw this.failure;
    return { tip_id: TIP_ID, qr_code: "qr", copy_paste_code: "copy" };
  }

  async getCharge(): Promise<BoostChargeResult | null> {
    return null;
  }
}

/**
 * 🔴 PAGA ANTES (28/set/2026): o PIX do destaque nasce no PEDIDO.
 *
 * O que estes testes guardam: cobrança só depois das regras (nunca cobrar um
 * pedido que seria recusado), PIX gerado ainda não destaca, e falha do
 * provedor não cria pedido com destaque pela metade.
 */
describe("CreateRequestUseCase — destaque pago no pedido", () => {
  const now = new Date("2026-01-01T10:00:00.000Z");
  const clock = new FakeClock(now);

  let repository: RequestInMemoryRepository;
  let eventRepository: EventInMemoryRepository;
  let musicianRepository: MusicianInMemoryRepository;
  let audienceRepository: AudienceInMemoryRepository;
  let charge: BoostChargeSpy;

  const build = (port: IBoostChargePort | undefined) =>
    new CreateRequestUseCase(
      repository,
      eventRepository,
      musicianRepository,
      audienceRepository,
      { belongsToMusician: async () => true },
      // Casa sem coordenada: presença aceita — este spec cuida do destaque.
      new VenueLocationInMemoryAdapter(),
      new PresenceVerifier(),
      10,
      120,
      clock,
      undefined,
      2,
      { acceptsTips: async () => true },
      port,
    );

  async function setup() {
    const eventId = new Uuid().id;
    const musicianId = new Uuid().id;
    const audienceId = new Uuid().id;
    await eventRepository.insert(
      new Event({
        event_id: new EventId(eventId),
        establishment_id: new Uuid(),
        name: "Event",
        start_at: now,
        end_at: new Date(now.getTime() + 60 * 60 * 1000),
        status: "active",
      }),
    );
    await musicianRepository.insert(
      Musician.create({
        musician_id: new MusicianId(musicianId),
        email: `${musicianId}@soundmeet.test`,
        name: "Musician",
        genres: ["rock"],
        instruments: ["guitar"],
      }),
    );
    await eventRepository.addPerformer(new EventId(eventId), { musician_id: musicianId });
    await audienceRepository.insert(
      new Audience({
        audience_id: new AudienceId(audienceId),
        email: `${audienceId}@soundmeet.test`,
        name: "Audience",
        is_active: true,
      }),
    );
    await eventRepository.addAttendee(new EventId(eventId), audienceId);
    return { eventId, musicianId, audienceId };
  }

  const input = (ids: { eventId: string; musicianId: string; audienceId: string }, amount = 10) => ({
    event_id: ids.eventId,
    musician_id: ids.musicianId,
    audience_id: ids.audienceId,
    song_title: "Evidências",
    artist: "Chitãozinho & Xororó",
    boost: { amount, dedication: "pra Ana" },
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    repository = new RequestInMemoryRepository();
    eventRepository = new EventInMemoryRepository();
    musicianRepository = new MusicianInMemoryRepository();
    audienceRepository = new AudienceInMemoryRepository();
    charge = new BoostChargeSpy();
  });

  afterEach(() => jest.useRealTimers());

  it("gera o PIX junto com o pedido — e o pedido ainda NÃO destaca", async () => {
    const ids = await setup();
    const output = await build(charge).execute(input(ids));

    expect(charge.calls).toHaveLength(1);
    expect(charge.calls[0]).toMatchObject({ musician_id: ids.musicianId, amount: 10, dedication: "pra Ana" });
    expect(output.boost?.status).toBe(RequestBoostStatusEnum.AWAITING_PAYMENT);
    expect(output.boost?.tip_id).toBe(TIP_ID);
    expect(output.is_boosted).toBe(false);

    const saved = await repository.findById(new RequestId(output.id));
    expect(saved!.boost!.isAwaitingPayment).toBe(true);
  });

  it("pedido sem destaque não chama o provedor", async () => {
    const ids = await setup();
    const { boost: _ignored, ...plain } = input(ids);
    await build(charge).execute(plain);
    expect(charge.calls).toHaveLength(0);
  });

  // Nunca cobrar um pedido que as regras recusariam.
  it("não cobra quando a policy recusa o pedido (destaque abaixo do piso)", async () => {
    const ids = await setup();
    await expect(build(charge).execute(input(ids, 1))).rejects.toThrow(EntityValidationError);
    expect(charge.calls).toHaveLength(0);
    expect(repository.items).toHaveLength(0);
  });

  // 🔴 Falha do provedor: nada de pedido com destaque pela metade.
  it("provedor fora do ar: o pedido com destaque não é criado", async () => {
    const ids = await setup();
    charge.failure = new Error("gateway down");
    await expect(build(charge).execute(input(ids))).rejects.toThrow(InvalidOperationError);
    expect(repository.items).toHaveLength(0);
  });

  // Fail closed: sem porta, jamais gravar destaque sem cobrança.
  it("sem a porta de cobrança, recusa o destaque em vez de gravá-lo sem PIX", async () => {
    const ids = await setup();
    await expect(build(undefined).execute(input(ids))).rejects.toThrow(InvalidOperationError);
    expect(repository.items).toHaveLength(0);
  });
});
