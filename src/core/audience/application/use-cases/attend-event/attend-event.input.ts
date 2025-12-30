import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsDateString,
} from "class-validator";

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
  @IsNotEmpty()
  @IsUUID()
  establishment_id: string;

  @IsDateString()
  @IsNotEmpty()
  event_date: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
