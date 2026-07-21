import { IsNotEmpty, IsString } from "class-validator";

export type AcceptBandInviteInputConstructorProps = {
  band_id: string;
  musician_id: string;
};

export class AcceptBandInviteInput {
  @IsString()
  @IsNotEmpty()
  band_id: string;

  @IsString()
  @IsNotEmpty()
  musician_id: string;

  constructor(props: AcceptBandInviteInputConstructorProps) {
    if (!props) return;
    this.band_id = props.band_id;
    this.musician_id = props.musician_id;
  }
}
