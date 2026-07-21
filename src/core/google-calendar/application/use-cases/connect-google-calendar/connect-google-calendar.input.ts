import { IsNotEmpty, IsString, IsUUID, validateSync } from "class-validator";

export type ConnectGoogleCalendarInputConstructorProps = {
  musician_id: string;
  code: string;
  redirect_uri: string;
};

export class ConnectGoogleCalendarInput {
  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  redirect_uri: string;

  constructor(props?: ConnectGoogleCalendarInputConstructorProps) {
    if (!props) return;
    this.musician_id = props.musician_id;
    this.code = props.code;
    this.redirect_uri = props.redirect_uri;
  }
}

export class ValidateConnectGoogleCalendarInput {
  static validate(input: ConnectGoogleCalendarInput) {
    return validateSync(input);
  }
}
