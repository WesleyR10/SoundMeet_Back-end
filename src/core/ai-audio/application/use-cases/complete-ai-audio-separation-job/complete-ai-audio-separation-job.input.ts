import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";

export type CompleteAiAudioSeparationJobOutputItemInput = {
  stem_name: string;
  object_key: string;
  content_type: string;
  file_size?: number | null;
};

export type CompleteAiAudioSeparationJobInput = {
  job_id: string;
  outputs: CompleteAiAudioSeparationJobOutputItemInput[];
};

export class CompleteAiAudioSeparationJobOutputItemInputValidator {
  @IsString()
  @IsNotEmpty()
  stem_name: string;

  @IsString()
  @IsNotEmpty()
  object_key: string;

  @IsString()
  @IsNotEmpty()
  content_type: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsOptional()
  file_size?: number | null;

  constructor(props: CompleteAiAudioSeparationJobOutputItemInput) {
    Object.assign(this, props);
  }
}

export class CompleteAiAudioSeparationJobInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  job_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompleteAiAudioSeparationJobOutputItemInputValidator)
  outputs: CompleteAiAudioSeparationJobOutputItemInputValidator[];

  constructor(props: CompleteAiAudioSeparationJobInput) {
    Object.assign(this, props);
  }
}
