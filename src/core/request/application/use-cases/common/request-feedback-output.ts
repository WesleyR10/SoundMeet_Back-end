import { RequestFeedback } from "../../../domain/request-feedback.aggregate";

export type RequestFeedbackOutput = {
  id: string;
  request_id: string;
  rating: number;
  comment: string | null;
  created_at: Date;
  has_comment: boolean;
  is_positive: boolean;
  is_neutral: boolean;
  is_negative: boolean;
};

export class RequestFeedbackOutputMapper {
  static toOutput(entity: RequestFeedback): RequestFeedbackOutput {
    const { request_feedback_id, ...otherProps } = entity.toJSON();
    return {
      id: request_feedback_id,
      ...otherProps,
    } as RequestFeedbackOutput;
  }
}
