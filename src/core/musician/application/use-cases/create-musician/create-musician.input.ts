import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
  Min,
  Max,
  validateSync,
} from "class-validator";

export type CreateMusicianInputConstructorProps = {
  email: string;
  name: string;
  stage_name?: string;
  bio?: string;
  avatar?: string;
  phone?: string;
  genres?: string[];
  instruments?: string[];
  experience_years?: number;
  is_active?: boolean;
};

export class CreateMusicianInput {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  stage_name?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsArray()
  @IsOptional()
  genres?: string[];

  @IsArray()
  @IsOptional()
  instruments?: string[];

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  experience_years?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  constructor(props: CreateMusicianInputConstructorProps) {
    if (!props) return;
    this.email = props.email;
    this.name = props.name;
    this.stage_name = props.stage_name;
    this.bio = props.bio;
    this.avatar = props.avatar;
    this.phone = props.phone;
    this.genres = props.genres;
    this.instruments = props.instruments;
    this.experience_years = props.experience_years;
    this.is_active = props.is_active ?? true;
  }
}

export class ValidateCreateMusicianInput {
  static validate(input: CreateMusicianInput) {
    return validateSync(input);
  }
}
