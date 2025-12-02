import { IsNotEmpty, IsString } from "class-validator";

export type RemoveBandMemberInputConstructorProps = {
  band_id: string;
  musician_id: string;
};

export class RemoveBandMemberInput {
  @IsString()
  @IsNotEmpty()
  band_id: string;

  @IsString()
  @IsNotEmpty()
  musician_id: string;

  constructor(props: RemoveBandMemberInputConstructorProps) {
    if (!props) return;
    this.band_id = props.band_id;
    this.musician_id = props.musician_id;
  }
}
