import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export type CreateAiCifraUploadInput = {
  musician_id: string;
  music_library_id?: string | null;
  original_filename: string;
  content_type: string;
  file_size: number;
  data: Buffer | NodeJS.ReadableStream;
};

export class CreateAiCifraUploadInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsString()
  @IsUUID()
  @IsOptional()
  music_library_id?: string | null;

  @IsString()
  @IsNotEmpty()
  original_filename: string;

  @IsString()
  @IsNotEmpty()
  content_type: string;

  @Min(1)
  @IsNumber()
  file_size: number;

  constructor(props: CreateAiCifraUploadInput) {
    Object.assign(this, props);
  }
}
