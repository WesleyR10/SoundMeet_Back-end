import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

import { BandMemberProps } from "../../../domain/band.aggregate";

export type CreateBandInputConstructorProps = {
  name: string;
  description?: string | null;
  avatar?: string | null;
  genres: string[];
  members?: BandMemberProps[];
  is_active?: boolean;
};

export class CreateBandInput {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsString()
  @IsOptional()
  avatar?: string | null;

  @IsArray()
  @IsString({ each: true })
  genres: string[];

  @IsArray()
  @IsOptional()
  members?: BandMemberProps[];

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  constructor(props: CreateBandInputConstructorProps) {
    if (!props) return;
    this.name = props.name;
    this.description = props.description;
    this.avatar = props.avatar;
    this.genres = props.genres;
    this.members = props.members;
    this.is_active = props.is_active;
  }
}
