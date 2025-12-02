import { IsNotEmpty, IsString } from "class-validator";

export type GetBandInputConstructorProps = {
  id: string;
};

export class GetBandInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  constructor(props: GetBandInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
  }
}
