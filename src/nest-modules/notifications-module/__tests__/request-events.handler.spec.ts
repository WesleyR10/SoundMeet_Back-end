import { Musician } from "../../../core/musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../core/musician/domain/musician.repository";
import { RequestAcceptedEvent } from "../../../core/request/domain/events/request-accepted.event";
import { RequestCreatedEvent } from "../../../core/request/domain/events/request-created.event";
import { RequestRejectedEvent } from "../../../core/request/domain/events/request-rejected.event";
import { RequestId } from "../../../core/request/domain/request.aggregate";
import { NotificationsGateway } from "../notifications.gateway";
import { PushNotificationService } from "../push-notification.service";
import { RequestEventsHandler } from "../request-events.handler";

const makeGatewayMock = (): jest.Mocked<
  Pick<NotificationsGateway, "notifyRequestStatusChanged" | "notifyNewRequest">
> => ({
  notifyRequestStatusChanged: jest.fn(),
  notifyNewRequest: jest.fn(),
});

const makeMusicianRepoMock = (): jest.Mocked<
  Pick<IMusicianRepository, "findById">
> => ({
  findById: jest.fn(),
});

const makePushServiceMock = (): jest.Mocked<Pick<PushNotificationService, "send">> => ({
  send: jest.fn(),
});

describe("RequestEventsHandler", () => {
  let handler: RequestEventsHandler;
  let gateway: jest.Mocked<
    Pick<NotificationsGateway, "notifyRequestStatusChanged" | "notifyNewRequest">
  >;
  let musicianRepo: jest.Mocked<Pick<IMusicianRepository, "findById">>;
  let pushNotificationService: jest.Mocked<Pick<PushNotificationService, "send">>;

  const requestId = new RequestId();
  const audienceId = "audience-uuid-001";
  const musicianId = "8c0e9a2e-1b7a-4f3e-9c2a-2a6b1e4d5f01";
  const songTitle = "Bohemian Rhapsody";

  beforeEach(() => {
    gateway = makeGatewayMock();
    musicianRepo = makeMusicianRepoMock();
    pushNotificationService = makePushServiceMock();
    handler = new RequestEventsHandler(
      gateway as unknown as NotificationsGateway,
      musicianRepo as unknown as IMusicianRepository,
      pushNotificationService as unknown as PushNotificationService,
    );
  });

  describe("handleRequestAccepted", () => {
    it("should call notifyRequestStatusChanged with status accepted", () => {
      const event = new RequestAcceptedEvent({
        request_id: requestId,
        event_id: "evt-001",
        audience_id: audienceId,
        musician_id: musicianId,
        song_title: songTitle,
      });

      handler.handleRequestAccepted(event);

      expect(gateway.notifyRequestStatusChanged).toHaveBeenCalledTimes(1);
      expect(gateway.notifyRequestStatusChanged).toHaveBeenCalledWith(
        audienceId,
        expect.objectContaining({
          request_id: requestId.id,
          status: "accepted",
          musician_id: musicianId,
          song_title: songTitle,
        }),
      );
    });

    it("should include occurred_at as an ISO string", () => {
      const before = new Date();
      const event = new RequestAcceptedEvent({
        request_id: requestId,
        event_id: "evt-002",
        audience_id: audienceId,
        musician_id: musicianId,
        song_title: songTitle,
      });
      const after = new Date();

      handler.handleRequestAccepted(event);

      const [, payload] = (
        gateway.notifyRequestStatusChanged as jest.Mock
      ).mock.calls[0] as [string, { occurred_at: string }];

      const occurredAt = new Date(payload.occurred_at);
      expect(occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("handleRequestRejected", () => {
    it("should call notifyRequestStatusChanged with status rejected and rejection_reason", () => {
      const rejectionReason = "Song not in repertoire";
      const event = new RequestRejectedEvent({
        request_id: requestId,
        event_id: "evt-003",
        audience_id: audienceId,
        musician_id: musicianId,
        song_title: songTitle,
        rejection_reason: rejectionReason,
      });

      handler.handleRequestRejected(event);

      expect(gateway.notifyRequestStatusChanged).toHaveBeenCalledTimes(1);
      expect(gateway.notifyRequestStatusChanged).toHaveBeenCalledWith(
        audienceId,
        expect.objectContaining({
          request_id: requestId.id,
          status: "rejected",
          musician_id: musicianId,
          song_title: songTitle,
          rejection_reason: rejectionReason,
        }),
      );
    });

    it("should set rejection_reason to null when not provided", () => {
      const event = new RequestRejectedEvent({
        request_id: requestId,
        event_id: "evt-004",
        audience_id: audienceId,
        musician_id: musicianId,
        song_title: songTitle,
      });

      handler.handleRequestRejected(event);

      const [, payload] = (
        gateway.notifyRequestStatusChanged as jest.Mock
      ).mock.calls[0] as [string, { rejection_reason: string | null }];

      expect(payload.rejection_reason).toBeNull();
    });
  });

  describe("handleRequestCreated", () => {
    const artist = "Queen";
    const message = "Play it loud!";

    function makeEvent() {
      return new RequestCreatedEvent({
        request_id: requestId,
        event_id: "evt-005",
        audience_id: audienceId,
        musician_id: musicianId,
        song_title: songTitle,
        artist,
        message,
        created_at: new Date(),
      });
    }

    it("should call notifyNewRequest with the request payload", async () => {
      musicianRepo.findById.mockResolvedValue(null);

      await handler.handleRequestCreated(makeEvent());

      expect(gateway.notifyNewRequest).toHaveBeenCalledTimes(1);
      expect(gateway.notifyNewRequest).toHaveBeenCalledWith(
        musicianId,
        expect.objectContaining({
          request_id: requestId.id,
          audience_id: audienceId,
          musician_id: musicianId,
          song_title: songTitle,
          artist,
          message,
        }),
      );
    });

    it("should send a push notification when the musician has a push_token", async () => {
      const musician = Musician.fake().aMusician().build();
      musician.registerPushToken("ExponentPushToken[abc123]", "android");
      musicianRepo.findById.mockResolvedValue(musician);

      await handler.handleRequestCreated(makeEvent());

      expect(pushNotificationService.send).toHaveBeenCalledTimes(1);
      expect(pushNotificationService.send).toHaveBeenCalledWith(
        "ExponentPushToken[abc123]",
        expect.objectContaining({
          title: expect.any(String),
          body: `${songTitle} — ${artist}`,
        }),
      );
    });

    it("should not send a push notification when the musician has no push_token", async () => {
      const musician = Musician.fake().aMusician().build();
      musicianRepo.findById.mockResolvedValue(musician);

      await handler.handleRequestCreated(makeEvent());

      expect(pushNotificationService.send).not.toHaveBeenCalled();
    });

    it("should not throw when the musician repository fails", async () => {
      musicianRepo.findById.mockRejectedValue(new Error("db down"));

      await expect(handler.handleRequestCreated(makeEvent())).resolves.not.toThrow();
      expect(pushNotificationService.send).not.toHaveBeenCalled();
    });
  });
});
