import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class AttendEventInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  audience_id: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  event_id: string;

  @IsString()
  @IsOptional()
  @IsUUID()
  establishment_id?: string;
}
