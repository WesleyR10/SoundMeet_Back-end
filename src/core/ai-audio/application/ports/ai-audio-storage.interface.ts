import { Readable } from "node:stream";

export type AiAudioPutObjectInput = {
  object_key: string;
  data: Buffer | Readable;
  content_type: string;
};

export interface IAiAudioStorage {
  putObject(input: AiAudioPutObjectInput): Promise<void>;
  /**
   * Espelha `IAiCifraStorage.deleteObject`. Existe porque os stems têm prazo de
   * validade — ver `domain/stems-retention.ts`.
   */
  deleteObject(input: { object_key: string }): Promise<void>;
  getPublicUrl(object_key: string): string | null;
}
