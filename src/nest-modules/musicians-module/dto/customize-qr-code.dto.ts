import { ApiProperty } from "@nestjs/swagger";
import { IsHexColor, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class CustomizeQRCodeDto {
  @ApiProperty({
    description: "Cor de primeiro plano do QR Code (hex, ex.: #000000)",
    example: "#1a1a2e",
    required: false,
  })
  @IsHexColor()
  @IsOptional()
  foreground_color?: string;

  @ApiProperty({
    description: "Cor de fundo do QR Code (hex, ex.: #ffffff)",
    example: "#ffffff",
    required: false,
  })
  @IsHexColor()
  @IsOptional()
  background_color?: string;

  @ApiProperty({
    description: "URL da imagem de logo a incorporar no centro do QR",
    example: "https://cdn.soundmeet.app/logos/my-band.png",
    required: false,
  })
  @IsUrl()
  @IsOptional()
  logo_url?: string;

  @ApiProperty({
    description: "Texto exibido abaixo do QR Code",
    example: "Minha Banda — SoundMeet",
    required: false,
  })
  @IsString()
  @MaxLength(80)
  @IsOptional()
  label?: string;
}
