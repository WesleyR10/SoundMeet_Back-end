import { IsBoolean, IsNotEmpty, IsString } from "class-validator";

export type SetMusicianRequestScopeInputConstructorProps = {
  id: string;
  accepts_requests_outside_repertoire: boolean;
};

export class SetMusicianRequestScopeInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsBoolean()
  accepts_requests_outside_repertoire: boolean;

  constructor(props: SetMusicianRequestScopeInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.accepts_requests_outside_repertoire =
      props.accepts_requests_outside_repertoire;
  }
}
