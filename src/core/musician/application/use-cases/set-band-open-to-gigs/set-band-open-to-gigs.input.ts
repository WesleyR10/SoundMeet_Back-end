import { IsBoolean, IsNotEmpty, IsString } from "class-validator";

export type SetBandOpenToGigsInputConstructorProps = {
  band_id: string;
  open_to_gigs: boolean;
};

export class SetBandOpenToGigsInput {
  @IsString()
  @IsNotEmpty()
  band_id: string;

  @IsBoolean()
  open_to_gigs: boolean;

  constructor(props: SetBandOpenToGigsInputConstructorProps) {
    if (!props) return;
    this.band_id = props.band_id;
    this.open_to_gigs = props.open_to_gigs;
  }
}
