import {
  IsNotEmpty,
  IsString,
  IsUuid,
  IsOptional,
  IsDateString,
} from "class-validator";

export class AttendEventInput {
  @IsString()
  @IsNotEmpty()
  @IsUuid()
  audience_id: string;

  @IsString()
  @IsNotEmpty()
  @IsUuid()
  event_id: string;

  @IsString()
  @IsNotEmpty()
  @IsUuid()
  establishment_id: string;

  @IsDateString()
  @IsNotEmpty()
  event_date: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
