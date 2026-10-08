import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

import { IContractStorage } from "../../application/ports/contract-storage.interface";

/**
 * Storage S3/MinIO/R2 do contrato — **privado**.
 *
 * Espelha `S3EstablishmentStorage` a menos de duas diferenças deliberadas:
 *
 * 1. **não recebe `publicBaseUrl` e não expõe `getPublicUrl`.** Não é omissão:
 *    a classe não tem como produzir uma URL pública, então nenhum caminho
 *    futuro do código consegue vazar um contrato por engano;
 * 2. **implementa `getObject`.** É o primeiro `get` de storage do projeto, e
 *    existe porque o download precisa passar por rota autorizada que faz stream
 *    do objeto em vez de redirecionar para um bucket.
 */
export class S3ContractStorage implements IContractStorage {
  private static readonly DEFAULT_PART_SIZE_BYTES = 5 * 1024 * 1024;
  private static readonly DEFAULT_QUEUE_SIZE = 2;

  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
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
      partSize: S3ContractStorage.DEFAULT_PART_SIZE_BYTES,
      queueSize: S3ContractStorage.DEFAULT_QUEUE_SIZE,
    }).done();
  }

  async getObject(input: { object_key: string }): Promise<{
    data: Readable;
    content_type: string;
    content_length: number | null;
  } | null> {
    try {
      const result = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: input.object_key }),
      );

      if (!result.Body) return null;

      return {
        data: result.Body as Readable,
        content_type: result.ContentType ?? "application/octet-stream",
        content_length: result.ContentLength ?? null,
      };
    } catch (error: any) {
      /*
       * Chave inexistente devolve `null`, não exceção: contrato cujo documento
       * sumiu do storage é problema operacional (bucket trocado, objeto
       * expirado), e a rota precisa poder responder 404 em vez de 500. Qualquer
       * outro erro — credencial, rede, permissão — sobe, porque aí o problema é
       * nosso e esconder atrás de um 404 mandaria o suporte investigar o lado
       * errado.
       */
      const code = error?.name ?? error?.Code;
      if (
        code === "NoSuchKey" ||
        code === "NotFound" ||
        error?.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  async deleteObject(input: { object_key: string }): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: input.object_key,
      }),
    );
  }
}
