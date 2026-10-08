import { Readable } from "node:stream";

import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export type CreateAiAudioUploadInput = {
  musician_id: string;
  /** Modo Ensaio: a música da biblioteca que originou este áudio. */
  music_library_id?: string | null;
  original_filename: string;
  content_type: string;
  file_size: number;
  /**
   * `from_source` quando o áudio foi resolvido por provider (o app não envia
   * arquivo), `direct` quando o músico subiu um arquivo dele.
   */
  upload_method?: "direct" | "from_source";
  data: Buffer | Readable;
};

export class CreateAiAudioUploadInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsUUID()
  @IsOptional()
  music_library_id?: string;

  @IsIn(["direct", "from_source"])
  @IsOptional()
  upload_method?: "direct" | "from_source";

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
