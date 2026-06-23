export type AiAudioPutObjectInput = {
  object_key: string;
  data: Buffer | NodeJS.ReadableStream;
  content_type: string;
};

export interface IAiAudioStorage {
  putObject(input: AiAudioPutObjectInput): Promise<void>;
  getPublicUrl(object_key: string): string | null;
}
