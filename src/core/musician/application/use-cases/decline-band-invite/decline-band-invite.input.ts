import { IsNotEmpty, IsString } from "class-validator";

export type DeclineBandInviteInputConstructorProps = {
  band_id: string;
  musician_id: string;
};

export class DeclineBandInviteInput {
  @IsString()
  @IsNotEmpty()
  band_id: string;

  @IsString()
  @IsNotEmpty()
  musician_id: string;

  constructor(props: DeclineBandInviteInputConstructorProps) {
    if (!props) return;
    this.band_id = props.band_id;
    this.musician_id = props.musician_id;
  }
}
