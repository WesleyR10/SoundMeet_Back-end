export type AiAudioSeparationClientOutput = {
  stem_name: string;
  object_key: string;
  content_type: string;
  file_size?: number | null;
};

export type AiAudioSeparationClientRequest = {
  job_id: string;
  model_id: string;
  input_object_key: string;
  output_prefix: string;
  output_format?: "wav" | "flac" | "mp3";
};

export type AiAudioSeparationClientResponse = {
  outputs: AiAudioSeparationClientOutput[];
};

export interface IAiAudioSeparationClient {
  separate(
    input: AiAudioSeparationClientRequest,
  ): Promise<AiAudioSeparationClientResponse>;
}
