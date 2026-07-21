import { IsNotEmpty, IsUUID } from "class-validator";

export type SyncBookingConfirmedInputConstructorProps = {
  booking_id: string;
};

export class SyncBookingConfirmedInput {
  @IsUUID()
  @IsNotEmpty()
  booking_id: string;

  constructor(props?: SyncBookingConfirmedInputConstructorProps) {
    if (!props) return;
    this.booking_id = props.booking_id;
  }
}
