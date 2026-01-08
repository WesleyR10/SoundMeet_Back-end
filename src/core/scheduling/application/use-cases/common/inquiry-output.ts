import { Inquiry } from "../../../domain/inquiry.aggregate";

export type InquiryOutput = {
  id: string;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  event_id: string | null;
  subject: string | null;
  initial_message: string | null;
  status: string;
  expires_at: Date | null;
  accepted_at: Date | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  converted_at: Date | null;
  booking_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export class InquiryOutputMapper {
  static toOutput(entity: Inquiry): InquiryOutput {
    const { inquiry_id, ...otherProps } = entity.toJSON();
    return {
      id: inquiry_id,
      ...otherProps,
    } as InquiryOutput;
  }
}
