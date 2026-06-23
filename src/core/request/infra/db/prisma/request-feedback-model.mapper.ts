import {
  RequestFeedback,
  RequestFeedbackId,
} from "../../../domain/request-feedback.aggregate";

export type RequestFeedbackModelProps = {
  id: string;
  requestId: string;
  rating: number;
  comment: string | null;
  created_at: Date;
};

export class RequestFeedbackModelMapper {
  static toModel(entity: RequestFeedback): RequestFeedbackModelProps {
    return {
      id: entity.request_feedback_id.id,
      requestId: entity.request_id.id,
      rating: entity.rating,
      comment: entity.comment,
      created_at: entity.created_at,
    };
  }

  static toEntity(model: RequestFeedbackModelProps): RequestFeedback {
    return new RequestFeedback({
      request_feedback_id: new RequestFeedbackId(model.id),
      request_id: model.requestId,
      rating: model.rating,
      comment: model.comment,
      created_at: model.created_at,
    });
  }
}
