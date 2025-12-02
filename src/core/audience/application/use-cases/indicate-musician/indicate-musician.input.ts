import { IsNotEmpty, IsString, IsUuid, IsOptional } from "class-validator";

export class IndicateMusicianInput {
  @IsString()
  @IsNotEmpty()
  @IsUuid()
  audience_id: string;

  @IsString()
  @IsNotEmpty()
  @IsUuid()
  musician_id: string;

  @IsString()
  @IsNotEmpty()
  @IsUuid()
  establishment_id: string;

  @IsString()
  @IsOptional()
  message?: string;
}
