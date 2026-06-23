import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export type UpdateAiAudioSeparationJobProgressInput = {
  id: string;
  progress_percent: number;
  progress_stage?: string | null;
  outputs?: {
    stem_name: string;
    object_key: string;
    content_type: string;
    file_size?: number | null;
  }[];
};

export type UpdateAiAudioSeparationJobProgressOutputItem = NonNullable<
  UpdateAiAudioSeparationJobProgressInput["outputs"]
>[number];

export class UpdateAiAudioSeparationJobProgressOutputItemValidator {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  stem_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  object_key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  content_type: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  file_size?: number | null;

  constructor(props: UpdateAiAudioSeparationJobProgressOutputItem) {
    Object.assign(this, props);
  }
}

export class UpdateAiAudioSeparationJobProgressInputValidator {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsInt()
  @Min(0)
  @Max(100)
  progress_percent: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  progress_stage?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAiAudioSeparationJobProgressOutputItemValidator)
  outputs?: UpdateAiAudioSeparationJobProgressOutputItemValidator[];

  constructor(props: UpdateAiAudioSeparationJobProgressInput) {
    this.id = props.id;
    this.progress_percent = props.progress_percent;
    this.progress_stage = props.progress_stage;
    this.outputs = Array.isArray(props.outputs)
      ? props.outputs.map(
          (o) => new UpdateAiAudioSeparationJobProgressOutputItemValidator(o),
        )
      : undefined;
  }
}
