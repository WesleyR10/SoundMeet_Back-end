import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export type DissolveBandInputConstructorProps = {
  id: string;
  requesting_musician_id?: string | null;
  is_admin?: boolean;
};

export class DissolveBandInput {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  // `sub` do JWT — só o líder atual dissolve a banda.
  @IsUUID()
  @IsOptional()
  requesting_musician_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props?: DissolveBandInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.requesting_musician_id = props.requesting_musician_id;
    this.is_admin = props.is_admin ?? false;
  }
}
