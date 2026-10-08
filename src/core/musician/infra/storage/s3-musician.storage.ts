import { Readable } from "node:stream";

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

import { IMusicianStorage } from "../../application/ports/musician-storage.interface";

export class S3MusicianStorage implements IMusicianStorage {
  private static readonly DEFAULT_PART_SIZE_BYTES = 5 * 1024 * 1024;
  private static readonly DEFAULT_QUEUE_SIZE = 2;

  /**
   * Um ano, imutável.
   *
   * Toda chave gravada por aqui leva um uuid novo (foto, logo do QR, áudio de
   * apresentação): o conteúdo de uma URL NUNCA muda — trocar a foto gera
   * outra URL. Sem este cabeçalho o objeto saía sem política de cache, e
   * navegador e CDN revalidavam a mesma foto a cada exibição da grade.
   *
   * ⚠️ Só vale enquanto a chave for única por envio. Se algum dia uma chave
   * for sobrescrita, este cabeçalho serve o arquivo velho por um ano.
   */
  private static readonly IMMUTABLE_CACHE_CONTROL =
    "public, max-age=31536000, immutable";

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
        CacheControl: S3MusicianStorage.IMMUTABLE_CACHE_CONTROL,
      },
      partSize: S3MusicianStorage.DEFAULT_PART_SIZE_BYTES,
      queueSize: S3MusicianStorage.DEFAULT_QUEUE_SIZE,
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
