import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateAudienceInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  nickname?: string | null;

  @IsString()
  @IsOptional()
  avatar?: string | null;

  @IsString()
  @IsOptional()
  phone?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  favorite_genres?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  favorite_artists?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  favorite_instruments?: string[];

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
