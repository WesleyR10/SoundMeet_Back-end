import { AddPointsUseCase } from "../../../core/gamification/application/use-cases/add-points/add-points.use-case";
import { PointsSourceEnum } from "../../../core/gamification/domain/value-objects/points-source.vo";
import { RequestAcceptedEvent } from "../../../core/request/domain/events/request-accepted.event";
import { RequestCreatedEvent } from "../../../core/request/domain/events/request-created.event";
import { RequestPlayedEvent } from "../../../core/request/domain/events/request-played.event";
import { RequestId } from "../../../core/request/domain/request.aggregate";
import { RequestEventProcessingService } from "../request-event-processing.service";
import { RequestEventsHandlers } from "../request-events.handlers";

describe("RequestEventsHandlers", () => {
  const requestIdValue = "550e8400-e29b-41d4-a716-446655440001";
  const eventId = "550e8400-e29b-41d4-a716-446655440002";
  const audienceId = "550e8400-e29b-41d4-a716-446655440003";
  const musicianId = "550e8400-e29b-41d4-a716-446655440004";

  let addPointsUseCase: jest.Mocked<Pick<AddPointsUseCase, "execute">>;
  let eventProcessing: jest.Mocked<
    Pick<RequestEventProcessingService, "processOnce">
  >;
  let handlers: RequestEventsHandlers;

  beforeEach(() => {
    addPointsUseCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    };
    eventProcessing = {
      processOnce: jest.fn((_key, work) => work()),
    };
    handlers = new RequestEventsHandlers(
      addPointsUseCase as AddPointsUseCase,
      eventProcessing as RequestEventProcessingService,
    );
  });

  it("adds request points through the gamification ledger when a request is created", async () => {
    const requestId = new RequestId(requestIdValue);

    await handlers.handleRequestCreated(
      new RequestCreatedEvent({
        request_id: requestId,
        event_id: eventId,
        audience_id: audienceId,
        musician_id: musicianId,
        song_title: "Song Title",
        artist: "Artist",
        message: null,
        created_at: new Date("2025-01-01T00:00:00.000Z"),
      }),
    );

    expect(addPointsUseCase.execute).toHaveBeenCalledWith({
      user_id: audienceId,
      source: PointsSourceEnum.REQUEST,
      metadata: expect.objectContaining({
        request_id: requestId.id,
        event_id: eventId,
        musician_id: musicianId,
      }),
    });
    expect(eventProcessing.processOnce).toHaveBeenCalledWith(
      `created:${requestId.id}:${audienceId}`,
      expect.any(Function),
    );
  });

  it("adds accepted request points through the gamification ledger", async () => {
    const requestId = new RequestId(requestIdValue);

    await handlers.handleRequestAccepted(
      new RequestAcceptedEvent({
        request_id: requestId,
        event_id: eventId,
        audience_id: audienceId,
        musician_id: musicianId,
        song_title: "Song Title",
      }),
    );

    expect(addPointsUseCase.execute).toHaveBeenCalledWith({
      user_id: audienceId,
      source: PointsSourceEnum.ACCEPTED_REQUEST,
      metadata: expect.objectContaining({
        request_id: requestId.id,
      }),
    });
  });

  it("adds a bonus ledger entry when a request is played", async () => {
    const requestId = new RequestId(requestIdValue);

    await handlers.handleRequestPlayed(
      new RequestPlayedEvent({
        request_id: requestId,
        event_id: eventId,
        audience_id: audienceId,
        musician_id: musicianId,
        song_title: "Song Title",
        played_at: new Date("2025-01-01T00:00:00.000Z"),
      }),
    );

    expect(addPointsUseCase.execute).toHaveBeenCalledWith({
      user_id: audienceId,
      source: PointsSourceEnum.BONUS,
      metadata: expect.objectContaining({
        points: 10,
        request_id: requestId.id,
        description: "Bonus points for a played request",
      }),
    });
  });
});
