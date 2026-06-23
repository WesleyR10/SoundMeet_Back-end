import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export type ProcessAiAudioSeparationJobInput = {
  job_id: string;
};

export class ProcessAiAudioSeparationJobInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  job_id: string;

  constructor(props: ProcessAiAudioSeparationJobInput) {
    Object.assign(this, props);
  }
}
