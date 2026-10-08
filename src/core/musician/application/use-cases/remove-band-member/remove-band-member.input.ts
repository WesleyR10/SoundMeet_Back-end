import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export type RemoveBandMemberInputConstructorProps = {
  band_id: string;
  musician_id: string;
  requesting_musician_id?: string | null;
  is_admin?: boolean;
};

export class RemoveBandMemberInput {
  @IsString()
  @IsNotEmpty()
  band_id: string;

  @IsString()
  @IsNotEmpty()
  musician_id: string;

  // `sub` do JWT. Decide entre "o líder remove alguém" e "eu saio da banda".
  @IsUUID()
  @IsOptional()
  requesting_musician_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props: RemoveBandMemberInputConstructorProps) {
    if (!props) return;
    this.band_id = props.band_id;
    this.musician_id = props.musician_id;
    this.requesting_musician_id = props.requesting_musician_id;
    this.is_admin = props.is_admin ?? false;
  }
}
