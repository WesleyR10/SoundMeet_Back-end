import { IsNotEmpty, IsUUID } from "class-validator";

export type SyncBookingCancelledInputConstructorProps = {
  booking_id: string;
};

export class SyncBookingCancelledInput {
  @IsUUID()
  @IsNotEmpty()
  booking_id: string;

  constructor(props?: SyncBookingCancelledInputConstructorProps) {
    if (!props) return;
    this.booking_id = props.booking_id;
  }
}
