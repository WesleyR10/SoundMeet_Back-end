import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class IndicateMusicianInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  audience_id: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  musician_id: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  establishment_id: string;

  @IsString()
  @IsOptional()
  message?: string;
}
