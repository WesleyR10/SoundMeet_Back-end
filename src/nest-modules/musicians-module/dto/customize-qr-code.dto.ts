import { ApiProperty } from "@nestjs/swagger";
import {
  Equals,
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";

// Semântica de JSON merge patch (RFC 7396): campo ausente = mantém o valor
// atual; campo com valor = define; `null` = remove a customização daquele
// campo (volta ao padrão). Ver Musician.customizeQRCode().
export class CustomizeQRCodeDto {
  @ApiProperty({
    description:
      "Cor de primeiro plano do QR Code (hex, ex.: #000000). Envie null para remover e voltar ao padrão.",
    example: "#1a1a2e",
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsHexColor()
  foreground_color?: string | null;

  @ApiProperty({
    description:
      "Cor de fundo do QR Code (hex, ex.: #ffffff). Envie null para remover e voltar ao padrão.",
    example: "#ffffff",
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsHexColor()
  background_color?: string | null;

  // Só aceita `null` (remove o logo atual). Definir um logo exige
  // POST /musicians/:id/qr-code/logo — endpoint dedicado que valida
  // tamanho/mimetype e sobe o arquivo pro storage antes de gravar a URL.
  // Aceitar uma URL arbitrária aqui contornaria essa validação inteira.
  @ApiProperty({
    description:
      "Só aceita null, para remover o logo atual. Para definir um novo logo, use POST /musicians/:id/qr-code/logo.",
    nullable: true,
    required: false,
  })
  @ValidateIf((_, value) => value !== undefined)
  @Equals(null, {
    message:
      "logo_url só aceita null (remover logo). Para definir um logo, use POST /musicians/:id/qr-code/logo.",
  })
  logo_url?: null;

  @ApiProperty({
    description:
      "Texto exibido abaixo do QR Code. Envie null para remover e voltar ao padrão.",
    example: "Minha Banda — SoundMeet",
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string | null;
}
