import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Inquiry, InquiryId } from "../../../domain/inquiry.aggregate";

export type InquiryModelProps = {
  id: string;
  establishmentId: string;
  musicianId: string | null;
  bandId: string | null;
  eventId: string | null;
  subject: string | null;
  initial_message: string | null;
  status: string;
  expires_at: Date | null;
  accepted_at: Date | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  converted_at: Date | null;
  bookingId: string | null;
  created_at: Date;
  updated_at: Date;
};

export class InquiryModelMapper {
  static toModel(entity: Inquiry): InquiryModelProps {
    return {
      id: entity.inquiry_id.id,
      establishmentId: entity.establishment_id.id,
      musicianId: entity.musician_id?.id ?? null,
      bandId: entity.band_id?.id ?? null,
      eventId: entity.event_id?.id ?? null,
      subject: entity.subject,
      initial_message: entity.initial_message,
      status: entity.status.value,
      expires_at: entity.expires_at,
      accepted_at: entity.accepted_at,
      rejected_at: entity.rejected_at,
      rejection_reason: entity.rejection_reason,
      converted_at: entity.converted_at,
      bookingId: entity.booking_id?.id ?? null,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: InquiryModelProps): Inquiry {
    const inquiry = new Inquiry({
      inquiry_id: new InquiryId(model.id),
      establishment_id: model.establishmentId,
      musician_id: model.musicianId,
      band_id: model.bandId,
      event_id: model.eventId,
      subject: model.subject,
      initial_message: model.initial_message,
      status: model.status,
      expires_at: model.expires_at,
      accepted_at: model.accepted_at,
      rejected_at: model.rejected_at,
      rejection_reason: model.rejection_reason,
      converted_at: model.converted_at,
      booking_id: model.bookingId,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });

    inquiry.validate();

    if (inquiry.notification.hasErrors()) {
      throw new LoadEntityError(inquiry.notification.toJSON());
    }

    return inquiry;
  }
}
