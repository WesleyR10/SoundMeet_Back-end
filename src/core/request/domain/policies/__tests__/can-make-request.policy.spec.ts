import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Request } from "../../request.aggregate";
import { CanMakeRequestPolicy } from "../can-make-request.policy";

describe("CanMakeRequestPolicy Unit Tests", () => {
  const makeCandidate = (
    props?: Partial<Parameters<typeof Request.create>[0]>,
  ) =>
    Request.create({
      event_id: new Uuid().id,
      audience_id: new Uuid().id,
      musician_id: new Uuid().id,
      song_title: "Song",
      artist: "Artist",
      ...props,
    });

  const makeContext = () => {
    const candidate = makeCandidate();
    return {
      event_status: "active",
      is_musician_performer: true,
      is_audience_attendee: true,
      requests_today_in_event: 0,
      max_requests_per_user_per_event: 10,
      has_pending_request_for_musician: false,
      recent_requests: [],
      candidate,
    };
  };

  test.each([
    {
      scenario: "event is not active",
      mutate: (ctx: any) => {
        ctx.event_status = "inactive";
      },
      expectedField: "event_id",
    },
    {
      scenario: "musician is not performer",
      mutate: (ctx: any) => {
        ctx.is_musician_performer = false;
      },
      expectedField: "musician_id",
    },
    {
      scenario: "audience is not attendee",
      mutate: (ctx: any) => {
        ctx.is_audience_attendee = false;
      },
      expectedField: "audience_id",
    },
    {
      scenario: "daily request limit exceeded",
      mutate: (ctx: any) => {
        ctx.requests_today_in_event = 10;
        ctx.max_requests_per_user_per_event = 10;
      },
      expectedField: "audience_id",
    },
    {
      scenario: "already has pending request for musician",
      mutate: (ctx: any) => {
        ctx.has_pending_request_for_musician = true;
      },
      expectedField: "musician_id",
    },
    {
      scenario: "similar recent request exists",
      mutate: (ctx: any) => {
        const recent = Request.create({
          event_id: ctx.candidate.event_id.id,
          audience_id: ctx.candidate.audience_id.id,
          musician_id: ctx.candidate.musician_id.id,
          song_title: ctx.candidate.song_title.value,
          artist: ctx.candidate.artist,
        });
        ctx.recent_requests = [recent];
      },
      expectedField: "song_title",
    },
  ])("should fail when $scenario", ({ mutate, expectedField }) => {
    const policy = new CanMakeRequestPolicy();
    const ctx = makeContext();
    mutate(ctx);

    const result = policy.evaluate(ctx);
    expect(result.isValid).toBe(false);
    const hasField = result.errors.some(
      (e) => typeof e === "object" && e !== null && expectedField in e,
    );
    expect(hasField).toBe(true);
  });

  it("should succeed when all rules are satisfied", () => {
    const policy = new CanMakeRequestPolicy();
    const ctx = makeContext();

    const result = policy.evaluate(ctx);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
