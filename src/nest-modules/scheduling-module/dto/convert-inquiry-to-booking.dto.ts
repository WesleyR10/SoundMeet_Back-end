import { ConvertInquiryToBookingInput } from "../../../core/scheduling/application/use-cases/convert-inquiry-to-booking/convert-inquiry-to-booking.input";

// inquiry_id is filled from the route param (:id), not the request body
export class ConvertInquiryToBookingDto extends ConvertInquiryToBookingInput {}
