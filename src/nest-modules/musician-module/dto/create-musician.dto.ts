import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  IsBoolean,
} from "class-validator";

export class CreateMusicianDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  stage_name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_verified?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instruments?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  experience_years?: number;
}
