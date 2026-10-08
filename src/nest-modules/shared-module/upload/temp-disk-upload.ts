import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { randomUUID } from "crypto";
import { diskStorage } from "multer";
import { tmpdir } from "os";

export type TempDiskUploadOptions = {
  /** Nome usado quando o cliente não manda `originalname`. */
  fallbackName: string;
  /** Teto em bytes. Acima disso o Multer aborta e o filtro global responde 413. */
  maxFileSize: number;
};

/**
 * Opções do Multer para um upload que passa por DISCO temporário.
 *
 * Era um bloco de ~20 linhas copiado em cada rota de upload do controller de
 * músicos (foto, logo do QR, áudio de apresentação). Três cópias do mesmo
 * bloco são três lugares para um ajuste de segurança não chegar.
 *
 * Três decisões moram aqui, e valem para todo upload que usar o helper:
 *
 * - **Disco, não memória.** O arquivo é lido em stream para o storage; em
 *   memória, dez uploads simultâneos de 10 MB seriam 100 MB de heap.
 * - **Nome saneado e único.** O `originalname` é do cliente: só `[A-Za-z0-9._-]`
 *   sobrevive, e o prefixo com data e uuid impede colisão e travessia de
 *   diretório.
 * - **Sem `fileFilter`, de propósito.** O `file.mimetype` é o `Content-Type`
 *   que o CLIENTE escreveu: filtrar por ele recusa arquivo bom (seletor de
 *   celular manda `application/octet-stream` para um MP3 legítimo) e não barra
 *   arquivo ruim. E um `fileFilter` que lança `Error` cru vira 500, porque o
 *   Nest só traduz os erros que o próprio Multer conhece. Quem decide o
 *   formato é `assertFileSignature`, no handler, lendo os bytes.
 *
 * ⚠️ Quem chama continua responsável por apagar `file.path` num `finally`.
 */
export function tempDiskUpload(options: TempDiskUploadOptions): MulterOptions {
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, tmpdir()),
      filename: (_req, file, cb) => {
        const safeName = (file.originalname || options.fallbackName).replace(
          /[^a-zA-Z0-9._-]/g,
          "_",
        );
        cb(null, `${Date.now()}-${randomUUID()}-${safeName}`);
      },
    }),
    limits: { fileSize: options.maxFileSize },
  };
}
