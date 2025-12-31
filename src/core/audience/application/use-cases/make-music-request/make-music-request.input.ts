import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

export type MakeMusicRequestInput = {
  id: string;
  musician_id: string;
  song_title: string;
  artist_name: string;
  genre?: string;
  difficulty?: string;
  event_id?: string;
  establishment_id?: string;
  message?: string;
  is_priority?: boolean;
  metadata?: Record<string, any>;
};

export class MakeMusicRequestInputValidator {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  musician_id: string;

  @IsString()
  @IsNotEmpty()
  song_title: string;

  @IsString()
  @IsNotEmpty()
  artist_name: string;

  @IsString()
  @IsOptional()
  genre?: string;

  @IsString()
  @IsOptional()
  difficulty?: string;

  @IsString()
  @IsOptional()
  event_id?: string;

  @IsString()
  @IsOptional()
  establishment_id?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsBoolean()
  @IsOptional()
  is_priority?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  constructor(props: MakeMusicRequestInput) {
    Object.assign(this, props);
  }
}
