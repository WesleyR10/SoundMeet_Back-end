import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";

export class AddEventPerformerDto {
  @ValidateIf((o) => o.band_id === undefined || o.band_id === null)
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  musician_id?: string | null;

  @ValidateIf((o) => o.musician_id === undefined || o.musician_id === null)
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  band_id?: string | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  fee?: number | null;

  @IsString()
  @IsOptional()
  status?: string;

  @IsDate()
  @IsOptional()
  start_at?: Date | null;

  @IsDate()
  @IsOptional()
  end_at?: Date | null;
}
