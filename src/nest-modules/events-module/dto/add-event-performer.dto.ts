import { Type } from "class-transformer";
import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";

import { EventMusicianStatus } from "../../../core/events/domain/event-musician.aggregate";

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
  status?: EventMusicianStatus;

  // Horário do SET do performer (não o do evento). Sem @Type o corpo JSON
  // chega com string e o 422 sai antes do use case — ver
  // `create-event.input.ts`.
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  start_at?: Date | null;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  end_at?: Date | null;
}
