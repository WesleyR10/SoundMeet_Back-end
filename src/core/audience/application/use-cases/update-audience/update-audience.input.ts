import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  validateSync,
} from "class-validator";

export type UpdateAudienceInputConstructorProps = {
  id: string;
  name?: string;
  nickname?: string | null;
  avatar?: string | null;
  phone?: string | null;
  favorite_genres?: string[];
  favorite_artists?: string[];
  favorite_instruments?: string[];
  is_active?: boolean;
};

export class UpdateAudienceInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

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

  constructor(props: UpdateAudienceInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    props.name !== undefined && (this.name = props.name);
    props.nickname !== undefined && (this.nickname = props.nickname);
    props.avatar !== undefined && (this.avatar = props.avatar);
    props.phone !== undefined && (this.phone = props.phone);
    props.favorite_genres !== undefined &&
      (this.favorite_genres = props.favorite_genres);
    props.favorite_artists !== undefined &&
      (this.favorite_artists = props.favorite_artists);
    props.favorite_instruments !== undefined &&
      (this.favorite_instruments = props.favorite_instruments);
    props.is_active !== undefined && (this.is_active = props.is_active);
  }
}

export class ValidateUpdateAudienceInput {
  static validate(input: UpdateAudienceInput) {
    return validateSync(input);
  }
}
