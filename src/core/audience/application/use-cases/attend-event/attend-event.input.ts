import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class AttendEventInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  audience_id: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  event_id: string;
}
