import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export type GetAiAudioSeparationJobInput = {
  id: string;
  requesting_musician_id?: string;
  is_admin?: boolean;
};

export class GetAiAudioSeparationJobInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  constructor(props: GetAiAudioSeparationJobInput) {
    Object.assign(this, props);
  }
}
