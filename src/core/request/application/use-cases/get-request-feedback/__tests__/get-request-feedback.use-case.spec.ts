import { Event, EventId } from "@core/events/domain";
import { EventInMemoryRepository } from "@core/events/infra/db/in-memory";

import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Request } from "../../../../domain/request.aggregate";
import { RequestFeedback } from "../../../../domain/request-feedback.aggregate";
import { RequestFeedbackInMemoryRepository } from "../../../../infra/db/in-memory/request-feedback-in-memory.repository";
import { RequestInMemoryRepository } from "../../../../infra/db/in-memory/request-in-memory.repository";
import { GetRequestFeedbackUseCase } from "../get-request-feedback.use-case";

describe("GetRequestFeedbackUseCase Unit Tests", () => {
  let useCase: GetRequestFeedbackUseCase;
  let feedbackRepo: RequestFeedbackInMemoryRepository;
  let requestRepo: RequestInMemoryRepository;
  let eventRepo: EventInMemoryRepository;

  beforeEach(() => {
    feedbackRepo = new RequestFeedbackInMemoryRepository();
    requestRepo = new RequestInMemoryRepository();
    eventRepo = new EventInMemoryRepository();
    useCase = new GetRequestFeedbackUseCase(
      feedbackRepo,
      requestRepo,
      eventRepo,
    );
  });

  const buildRequestWithFeedback = async () => {
    const request = Request.create({
      event_id: new Uuid().id,
      audience_id: new Uuid().id,
      musician_id: new Uuid().id,
      song_title: "Song",
    });
    await requestRepo.insert(request);

    const feedback = RequestFeedback.create({
      request_id: request.request_id.id,
      rating: 5,
      comment: "Nice",
    });
    await feedbackRepo.insert(feedback);

    return request;
  };

  it("should throw when feedback does not exist", async () => {
    await expect(() =>
      useCase.execute({ request_id: new Uuid().id }),
    ).rejects.toThrow(NotFoundError);
  });

  it("should allow the requesting audience to view the feedback", async () => {
    const request = await buildRequestWithFeedback();

    const output = await useCase.execute({
      request_id: request.request_id.id,
      requesting_participant_ids: [request.audience_id.id],
    });

    expect(output.request_id).toBe(request.request_id.id);
  });

  it("should allow the target musician to view the feedback", async () => {
    const request = await buildRequestWithFeedback();

    const output = await useCase.execute({
      request_id: request.request_id.id,
      requesting_participant_ids: [request.musician_id.id],
    });

    expect(output.request_id).toBe(request.request_id.id);
  });

  it("should allow the establishment that owns the event to view the feedback", async () => {
    const request = await buildRequestWithFeedback();
    const establishment_id = new Uuid().id;
    const owner_sub = new Uuid().id;
    await eventRepo.insert(
      new Event({
        event_id: new EventId(request.event_id.id),
        establishment_id: new Uuid(establishment_id),
        name: "Event",
        start_at: new Date(),
        end_at: new Date(Date.now() + 60 * 60 * 1000),
        status: "active",
      }),
    );

    const output = await useCase.execute({
      request_id: request.request_id.id,
      // Como o JWT real chega: `sub` do dono + claim establishment_ids.
      requesting_participant_ids: [owner_sub, establishment_id],
    });

    expect(output.request_id).toBe(request.request_id.id);
  });

  // O `sub` do dono nunca é igual ao UUID do estabelecimento — era assim que
  // a conta de estabelecimento levava 403 na avaliação do próprio evento.
  it("should reject the establishment owner's sub without the establishment_ids claim", async () => {
    const request = await buildRequestWithFeedback();
    const establishment_id = new Uuid().id;
    const owner_sub = new Uuid().id;
    await eventRepo.insert(
      new Event({
        event_id: new EventId(request.event_id.id),
        establishment_id: new Uuid(establishment_id),
        name: "Event",
        start_at: new Date(),
        end_at: new Date(Date.now() + 60 * 60 * 1000),
        status: "active",
      }),
    );

    await expect(() =>
      useCase.execute({
        request_id: request.request_id.id,
        requesting_participant_ids: [owner_sub],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("should throw ForbiddenException for an unrelated user", async () => {
    const request = await buildRequestWithFeedback();

    await expect(() =>
      useCase.execute({
        request_id: request.request_id.id,
        requesting_participant_ids: [new Uuid().id],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("should allow admin regardless of ownership", async () => {
    const request = await buildRequestWithFeedback();

    const output = await useCase.execute({
      request_id: request.request_id.id,
      requesting_participant_ids: [new Uuid().id],
      is_admin: true,
    });

    expect(output.request_id).toBe(request.request_id.id);
  });
});
