import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class DeleteBandInput {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  constructor(props?: DeleteBandInput) {
    if (!props) return;
    this.id = props.id;
  }
}
