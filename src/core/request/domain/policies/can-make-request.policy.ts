import { IPolicy } from "../../../shared/domain/policies/policy.interface";
import { PolicyResult } from "../../../shared/domain/policies/policy-result";
import { Request } from "../request.aggregate";

export type CanMakeRequestPolicyContext = {
  event_status: string;
  is_musician_performer: boolean;
  is_audience_attendee: boolean;
  requests_today_in_event: number;
  max_requests_per_user_per_event: number;
  has_pending_request_for_musician: boolean;
  recent_requests: Request[];
  candidate: Request;
};

export class EventMustBeActivePolicy implements IPolicy<CanMakeRequestPolicyContext> {
  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    if (context.event_status === "active") {
      return PolicyResult.ok();
    }

    return PolicyResult.fail([
      {
        event_id: ["Event is not active"],
      },
    ]);
  }
}

export class MusicianMustBePerformerPolicy implements IPolicy<CanMakeRequestPolicyContext> {
  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    if (context.is_musician_performer) {
      return PolicyResult.ok();
    }

    return PolicyResult.fail([
      {
        musician_id: ["Musician is not a performer in this event"],
      },
    ]);
  }
}

export class AudienceMustBeAttendeePolicy implements IPolicy<CanMakeRequestPolicyContext> {
  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    if (context.is_audience_attendee) {
      return PolicyResult.ok();
    }

    return PolicyResult.fail([
      {
        audience_id: ["Audience is not an active attendee in this event"],
      },
    ]);
  }
}

export class DailyRequestLimitPolicy implements IPolicy<CanMakeRequestPolicyContext> {
  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    if (
      context.requests_today_in_event < context.max_requests_per_user_per_event
    ) {
      return PolicyResult.ok();
    }

    return PolicyResult.fail([
      {
        audience_id: [
          `Daily request limit of ${context.max_requests_per_user_per_event} exceeded for this event`,
        ],
      },
    ]);
  }
}

export class NoPendingRequestForMusicianPolicy implements IPolicy<CanMakeRequestPolicyContext> {
  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    if (!context.has_pending_request_for_musician) {
      return PolicyResult.ok();
    }

    return PolicyResult.fail([
      {
        musician_id: ["You already have a pending request for this musician"],
      },
    ]);
  }
}

export class AntiSpamSimilarRecentRequestPolicy implements IPolicy<CanMakeRequestPolicyContext> {
  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    const hasSimilarRecentRequest = context.recent_requests.some((request) =>
      context.candidate.isSimilarTo(request),
    );

    if (!hasSimilarRecentRequest) {
      return PolicyResult.ok();
    }

    return PolicyResult.fail([
      {
        song_title: ["You have already requested this song recently"],
      },
    ]);
  }
}

export class CanMakeRequestPolicy implements IPolicy<CanMakeRequestPolicyContext> {
  private readonly policies: Array<IPolicy<CanMakeRequestPolicyContext>>;

  constructor(
    policies: Array<IPolicy<CanMakeRequestPolicyContext>> = [
      new EventMustBeActivePolicy(),
      new MusicianMustBePerformerPolicy(),
      new AudienceMustBeAttendeePolicy(),
      new DailyRequestLimitPolicy(),
      new NoPendingRequestForMusicianPolicy(),
      new AntiSpamSimilarRecentRequestPolicy(),
    ],
  ) {
    this.policies = policies;
  }

  evaluate(context: CanMakeRequestPolicyContext): PolicyResult {
    return this.policies.reduce(
      (result, policy) => result.merge(policy.evaluate(context)),
      PolicyResult.ok(),
    );
  }
}
