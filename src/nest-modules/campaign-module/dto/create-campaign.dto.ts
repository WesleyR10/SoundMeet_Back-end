import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CreateCampaignDto {
  @ApiProperty({ description: "UUID do estabelecimento dono da campanha" })
  @IsUUID()
  @IsNotEmpty()
  establishment_id: string;

  @ApiProperty({ description: "Título da campanha", example: "Noite de Samba" })
  @MaxLength(255)
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: "Descrição da campanha", required: false })
  @MaxLength(2000)
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiProperty({ description: "Data de início (ISO 8601)" })
  @IsDateString()
  @IsNotEmpty()
  start_date: Date;

  @ApiProperty({ description: "Data de término (ISO 8601)" })
  @IsDateString()
  @IsNotEmpty()
  end_date: Date;

  @ApiProperty({
    description: "Gêneros musicais alvo da campanha",
    isArray: true,
    example: ["samba", "pagode"],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  @IsOptional()
  target_genres?: string[];
}
