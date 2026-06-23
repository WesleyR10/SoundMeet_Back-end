export type AiAudioSeparationEnqueueCommand = {
  job_id: string;
  model_id: string;
  input_object_key: string;
  output_prefix: string;
  output_format?: "wav" | "flac" | "mp3" | null;
};

export interface IAiAudioSeparationDispatcher {
  enqueue(command: AiAudioSeparationEnqueueCommand): Promise<void>;
}
