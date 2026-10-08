import { Readable } from "node:stream";

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

import { IAiCifraStorage } from "../../application/ports/ai-cifra-storage.interface";

export class S3AiCifraStorage implements IAiCifraStorage {
  private static readonly DEFAULT_PART_SIZE_BYTES = 16 * 1024 * 1024;
  private static readonly DEFAULT_QUEUE_SIZE = 4;

  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
    private readonly publicBaseUrl: string | null,
  ) {}

  async putObject(input: {
    object_key: string;
    data: Buffer | Readable;
    content_type: string;
  }): Promise<void> {
    await new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: input.object_key,
        Body: input.data,
        ContentType: input.content_type,
      },
      partSize: S3AiCifraStorage.DEFAULT_PART_SIZE_BYTES,
      queueSize: S3AiCifraStorage.DEFAULT_QUEUE_SIZE,
    }).done();
  }

  async deleteObject(input: { object_key: string }): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: input.object_key,
      }),
    );
  }

  getPublicUrl(object_key: string): string | null {
    if (!this.publicBaseUrl) {
      return null;
    }
    const base = this.publicBaseUrl.endsWith("/")
      ? this.publicBaseUrl.slice(0, -1)
      : this.publicBaseUrl;
    return `${base}/${encodeURIComponent(object_key).replace(/%2F/g, "/")}`;
  }
}
