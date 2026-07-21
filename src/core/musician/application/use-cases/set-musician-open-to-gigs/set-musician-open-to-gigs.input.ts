import { IsBoolean, IsNotEmpty, IsString } from "class-validator";

export type SetMusicianOpenToGigsInputConstructorProps = {
  id: string;
  open_to_gigs: boolean;
};

export class SetMusicianOpenToGigsInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsBoolean()
  open_to_gigs: boolean;

  constructor(props: SetMusicianOpenToGigsInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.open_to_gigs = props.open_to_gigs;
  }
}
