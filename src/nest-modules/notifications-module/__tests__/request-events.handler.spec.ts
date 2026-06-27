import { RequestAcceptedEvent } from "../../../core/request/domain/events/request-accepted.event";
import { RequestRejectedEvent } from "../../../core/request/domain/events/request-rejected.event";
import { RequestId } from "../../../core/request/domain/request.aggregate";
import { NotificationsGateway } from "../notifications.gateway";
import { RequestEventsHandler } from "../request-events.handler";

const makeGatewayMock = (): jest.Mocked<
  Pick<NotificationsGateway, "notifyRequestStatusChanged">
> => ({
  notifyRequestStatusChanged: jest.fn(),
});

describe("RequestEventsHandler", () => {
  let handler: RequestEventsHandler;
  let gateway: jest.Mocked<Pick<NotificationsGateway, "notifyRequestStatusChanged">>;

  const requestId = new RequestId();
  const audienceId = "audience-uuid-001";
  const musicianId = "musician-uuid-001";
  const songTitle = "Bohemian Rhapsody";

  beforeEach(() => {
    gateway = makeGatewayMock();
    handler = new RequestEventsHandler(
      gateway as unknown as NotificationsGateway,
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
});
