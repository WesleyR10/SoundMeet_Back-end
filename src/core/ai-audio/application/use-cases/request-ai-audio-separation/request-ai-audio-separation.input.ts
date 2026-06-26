import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export type RequestAiAudioSeparationInput = {
  ai_audio_upload_id: string;
  model_id?: string;
  output_format?: "wav" | "flac" | "mp3";
  requesting_musician_id?: string;
  is_admin?: boolean;
};

export class RequestAiAudioSeparationInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  ai_audio_upload_id: string;

  @IsString()
  @IsOptional()
  model_id?: string;

  @IsIn(["wav", "flac", "mp3"])
  @IsOptional()
  output_format?: "wav" | "flac" | "mp3";

  constructor(props: RequestAiAudioSeparationInput) {
    Object.assign(this, props);
  }
}
