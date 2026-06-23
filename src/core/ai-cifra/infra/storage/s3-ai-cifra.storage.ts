import AWS from "aws-sdk";

import { IAiCifraStorage } from "../../application/ports/ai-cifra-storage.interface";

export class S3AiCifraStorage implements IAiCifraStorage {
  private static readonly DEFAULT_PART_SIZE_BYTES = 16 * 1024 * 1024;
  private static readonly DEFAULT_QUEUE_SIZE = 4;

  constructor(
    private readonly s3: AWS.S3,
    private readonly bucket: string,
    private readonly publicBaseUrl: string | null,
  ) {}

  async putObject(input: {
    object_key: string;
    data: Buffer | NodeJS.ReadableStream;
    content_type: string;
  }): Promise<void> {
    await this.s3
      .upload(
        {
          Bucket: this.bucket,
          Key: input.object_key,
          Body: input.data,
          ContentType: input.content_type,
        },
        {
          partSize: S3AiCifraStorage.DEFAULT_PART_SIZE_BYTES,
          queueSize: S3AiCifraStorage.DEFAULT_QUEUE_SIZE,
        },
      )
      .promise();
  }

  async deleteObject(input: { object_key: string }): Promise<void> {
    await this.s3
      .deleteObject({
        Bucket: this.bucket,
        Key: input.object_key,
      })
      .promise();
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
