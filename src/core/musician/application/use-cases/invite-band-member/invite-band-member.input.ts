import { IsNotEmpty, IsString } from "class-validator";

export type InviteBandMemberInputConstructorProps = {
  band_id: string;
  musician_id: string;
  role: string;
  instrument: string;
};

export class InviteBandMemberInput {
  @IsString()
  @IsNotEmpty()
  band_id: string;

  @IsString()
  @IsNotEmpty()
  musician_id: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsString()
  @IsNotEmpty()
  instrument: string;

  constructor(props: InviteBandMemberInputConstructorProps) {
    if (!props) return;
    this.band_id = props.band_id;
    this.musician_id = props.musician_id;
    this.role = props.role;
    this.instrument = props.instrument;
  }
}
