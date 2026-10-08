import { Event, EventId } from "../../../../../events/domain";
import { EventInMemoryRepository } from "../../../../../events/infra/db/in-memory/event-in-memory.repository";
import {
  Musician,
  MusicianId,
} from "../../../../../musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../../musician/infra/db/in-memory/musician-in-memory.repository";
import { Money } from "../../../../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { RequestBoostRefundPendingEvent } from "../../../../domain/events/request-boost-refund-pending.event";
import { Request } from "../../../../domain/request.aggregate";
import {
  RequestBoost,
  RequestBoostStatusEnum,
} from "../../../../domain/value-objects/request-boost.vo";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import {
  RespondToRequestAction,
  RespondToRequestInput,
} from "../respond-to-request.input";
import { RespondToRequestUseCase } from "../respond-to-request.use-case";

const TIP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/**
 * O aceite/recusa diante do destaque — modelo PAGA ANTES (28/set/2026).
 *
 * O PIX nasce no pedido (`CreateRequestUseCase`); aqui o destaque só muda de
 * estado. O que estes testes guardam é o dinheiro: pedido pago e recusado
 * TEM de virar `refund_pending` (senão o fã pagou por nada, em silêncio), e
 * PIX não pago de pedido recusado é cancelado.
 */
describe("RespondToRequestUseCase — destaque pago (paga antes)", () => {
  let useCase: RespondToRequestUseCase;
  let repository: RequestInMemoryRepository;
  let eventRepository: EventInMemoryRepository;
  let musicianRepository: MusicianInMemoryRepository;

  type BoostState = "promised" | "awaiting_payment" | "paid";

  async function setup(state: BoostState) {
    const eventId = new Uuid().id;
    const musicianId = new Uuid().id;
    const now = new Date();

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
    await eventRepository.addPerformer(new EventId(eventId), {
      musician_id: musicianId,
    });

    const request = Request.create({
      event_id: eventId,
      audience_id: new Uuid().id,
      musician_id: musicianId,
      song_title: "Evidências",
      artist: "Chitãozinho & Xororó",
      boost: new RequestBoost({ amount: new Money(10), dedication: "pra Ana" }),
    });
    if (state !== "promised") request.markBoostAwaitingPayment(TIP_ID);
    if (state === "paid") request.markBoostPaid();
    request.clearEvents();
    await repository.insert(request);

    return { request, musicianId };
  }

  function respond(request: Request, musicianId: string, action: RespondToRequestAction) {
    return useCase.execute(
      new RespondToRequestInput({
        request_id: request.request_id.id,
        musician_id: musicianId,
        action,
        ...(action === RespondToRequestAction.REJECT ? { rejection_reason: "Não sei tocar" } : {}),
      }),
    );
  }

  beforeEach(() => {
    repository = new RequestInMemoryRepository();
    eventRepository = new EventInMemoryRepository();
    musicianRepository = new MusicianInMemoryRepository();
    useCase = new RespondToRequestUseCase(repository, eventRepository, musicianRepository, 60);
  });

  it("aceitar NÃO cobra nada: o destaque pago continua pago", async () => {
    const { request, musicianId } = await setup("paid");
    const output = await respond(request, musicianId, RespondToRequestAction.ACCEPT);
    expect(output.boost?.status).toBe(RequestBoostStatusEnum.PAID);
    expect(output.is_boosted).toBe(true);
  });

  it("aceitar com PIX ainda não pago mantém a espera — e não destaca", async () => {
    const { request, musicianId } = await setup("awaiting_payment");
    const output = await respond(request, musicianId, RespondToRequestAction.ACCEPT);
    expect(output.boost?.status).toBe(RequestBoostStatusEnum.AWAITING_PAYMENT);
    expect(output.is_boosted).toBe(false);
  });

  it("promessa do modelo antigo (sem PIX) é cancelada no aceite — nunca será cobrada", async () => {
    const { request, musicianId } = await setup("promised");
    const output = await respond(request, musicianId, RespondToRequestAction.ACCEPT);
    expect(output.boost?.status).toBe(RequestBoostStatusEnum.CANCELLED);
    expect(output.boost?.cancellation_reason).toBe("legacy_promise_not_charged");
  });

  it("recusar com PIX ainda não pago cancela o destaque", async () => {
    const { request, musicianId } = await setup("awaiting_payment");
    const output = await respond(request, musicianId, RespondToRequestAction.REJECT);
    expect(output.boost?.status).toBe(RequestBoostStatusEnum.CANCELLED);
  });

  // 🔴 O caso de dinheiro: o fã pagou e o músico recusou.
  it("recusar pedido JÁ PAGO manda o destaque a reembolso e emite o evento", async () => {
    const { request, musicianId } = await setup("paid");
    const saved = await repository.findById(request.request_id);
    const output = await respond(saved!, musicianId, RespondToRequestAction.REJECT);

    expect(output.boost?.status).toBe(RequestBoostStatusEnum.REFUND_PENDING);
    expect(output.is_boosted).toBe(false);

    const entity = await repository.findById(request.request_id);
    expect(entity!.boost!.isRefundPending).toBe(true);
    expect(entity!.publicDedication).toBeNull();
  });

  it("o evento de reembolso pendente carrega o que o reembolso vai precisar", () => {
    const request = Request.create({
      event_id: new Uuid().id,
      audience_id: new Uuid().id,
      musician_id: new Uuid().id,
      song_title: "Evidências",
      boost: new RequestBoost({ amount: new Money(10) }),
    });
    request.markBoostAwaitingPayment(TIP_ID);
    request.markBoostPaid();
    request.clearEvents();

    request.reject("não");

    const event = Array.from(request.events).find((e) => e instanceof RequestBoostRefundPendingEvent) as
      | RequestBoostRefundPendingEvent
      | undefined;
    expect(event).toBeDefined();
    expect(event).toMatchObject({ tip_id: TIP_ID, amount: 10, reason: "request_rejected" });
  });
});
