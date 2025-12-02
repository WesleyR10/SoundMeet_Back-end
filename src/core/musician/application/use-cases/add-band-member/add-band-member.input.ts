import { IsNotEmpty, IsString, IsArray, IsOptional } from "class-validator";

export type AddBandMemberInputConstructorProps = {
  band_id: string;
  musician_id: string;
  role: string;
  instrument: string;
};

export class AddBandMemberInput {
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

  constructor(props: AddBandMemberInputConstructorProps) {
    if (!props) return;
    this.band_id = props.band_id;
    this.musician_id = props.musician_id;
    this.role = props.role;
    this.instrument = props.instrument;
  }
}
