import AWS from "aws-sdk";

import { IEstablishmentStorage } from "../../application/ports/establishment-storage.interface";

export class S3EstablishmentStorage implements IEstablishmentStorage {
  private static readonly DEFAULT_PART_SIZE_BYTES = 5 * 1024 * 1024;
  private static readonly DEFAULT_QUEUE_SIZE = 2;

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
          partSize: S3EstablishmentStorage.DEFAULT_PART_SIZE_BYTES,
          queueSize: S3EstablishmentStorage.DEFAULT_QUEUE_SIZE,
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
