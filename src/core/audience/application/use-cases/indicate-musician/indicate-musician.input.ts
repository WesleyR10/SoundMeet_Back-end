import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

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

  // Espelha o @MaxLength(1000) de `IndicationRules` — sem isto a validação de
  // borda passa e o agregado rejeita depois, virando 422 com mensagem de
  // domínio em vez de erro de campo.
  @MaxLength(1000)
  @IsString()
  @IsOptional()
  message?: string;
}
