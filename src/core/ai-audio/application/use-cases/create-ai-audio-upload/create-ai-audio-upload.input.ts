import { IsNotEmpty, IsNumber, IsString, IsUUID, Min } from "class-validator";

export type CreateAiAudioUploadInput = {
  musician_id: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  data: Buffer | NodeJS.ReadableStream;
};

export class CreateAiAudioUploadInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsString()
  @IsNotEmpty()
  original_filename: string;

  @IsString()
  @IsNotEmpty()
  content_type: string;

  @Min(1)
  @IsNumber()
  file_size: number;

  constructor(props: CreateAiAudioUploadInput) {
    Object.assign(this, props);
  }
}
