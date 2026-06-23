import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export type GetAiAudioSeparationJobInput = {
  id: string;
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
