import { Request } from "../../../domain/request.aggregate";

export type RequestOutput = {
  id: string;
  event_id: string;
  audience_id: string;
  musician_id: string;
  library_id: string | null;
  song_title: string;
  artist: string | null;
  message: string | null;
  status: string;
  rejection_reason: string | null;
  votes_count: number;
  played_at: Date | null;
  created_at: Date;
  updated_at: Date;
  responded_at: Date | null;
  is_pending: boolean;
  is_accepted: boolean;
  is_played: boolean;
  is_rejected: boolean;
  is_responded: boolean;
  has_message: boolean;
  display_title: string;
  age_in_minutes: number;
  is_recent: boolean;
  is_old: boolean;
  is_urgent: boolean;
  priority: "low" | "medium" | "high";
  points_value: {
    value: number;
    source: string;
    description?: string;
    metadata?: Record<string, any>;
    earnedAt: Date;
  };
  is_special_request: boolean;
  can_be_accepted: boolean;
  can_be_rejected: boolean;
  is_within_response_time: boolean;
};

export class RequestOutputMapper {
  static toOutput(entity: Request): RequestOutput {
    const { request_id, ...otherProps } = entity.toJSON();
    return {
      id: request_id,
      ...otherProps,
      points_value: entity.pointsValue.toJSON(),
      is_special_request: entity.isSpecialRequest,
      can_be_accepted: entity.canBeAccepted(),
      can_be_rejected: entity.canBeRejected(),
      is_within_response_time: entity.isWithinResponseTime(),
    } as RequestOutput;
  }
}
