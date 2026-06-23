import { Uuid } from "../../shared/domain";

export type AiAudioSeparationOutputConstructorProps = {
  ai_audio_separation_output_id?: AiAudioSeparationOutputId;
  stem_name: string;
  object_key: string;
  content_type: string;
  file_size?: number | null;
  created_at?: Date;
};

export class AiAudioSeparationOutputId extends Uuid {}

/**
 * Child entity owned by AiAudioSeparationJob. It is not an aggregate root and
 * must be persisted through the job repository.
 */
export class AiAudioSeparationOutput {
  ai_audio_separation_output_id: AiAudioSeparationOutputId;
  stem_name: string;
  object_key: string;
  content_type: string;
  file_size: number | null;
  created_at: Date;

  constructor(props: AiAudioSeparationOutputConstructorProps) {
    this.ai_audio_separation_output_id =
      props.ai_audio_separation_output_id ?? new AiAudioSeparationOutputId();
    this.stem_name = props.stem_name;
    this.object_key = props.object_key;
    this.content_type = props.content_type;
    this.file_size = props.file_size ?? null;
    this.created_at = props.created_at ?? new Date();
  }

  toJSON() {
    return {
      id: this.ai_audio_separation_output_id.id,
      stem_name: this.stem_name,
      object_key: this.object_key,
      content_type: this.content_type,
      file_size: this.file_size,
      created_at: this.created_at,
    };
  }
}
