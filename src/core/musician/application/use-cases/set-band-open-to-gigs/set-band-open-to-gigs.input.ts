import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export type SetBandOpenToGigsInputConstructorProps = {
  band_id: string;
  open_to_gigs: boolean;
  requesting_musician_id?: string | null;
  is_admin?: boolean;
};

export class SetBandOpenToGigsInput {
  @IsString()
  @IsNotEmpty()
  band_id: string;

  @IsBoolean()
  open_to_gigs: boolean;

  // `sub` do JWT — o consentimento de aparecer na busca é do líder atual.
  @IsUUID()
  @IsOptional()
  requesting_musician_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props: SetBandOpenToGigsInputConstructorProps) {
    if (!props) return;
    this.band_id = props.band_id;
    this.open_to_gigs = props.open_to_gigs;
    this.requesting_musician_id = props.requesting_musician_id;
    this.is_admin = props.is_admin ?? false;
  }
}
