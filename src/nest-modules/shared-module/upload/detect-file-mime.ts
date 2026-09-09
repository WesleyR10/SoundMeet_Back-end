import { UnprocessableEntityException } from "@nestjs/common";
import { open } from "fs/promises";

/**
 * Quantos bytes do início do arquivo bastam para identificar o formato.
 *
 * 4100 é o número que o `file-type` documenta como suficiente para todos os
 * formatos que ele reconhece (o pior caso é um cabeçalho ISO-BMFF com boxes
 * grandes antes do `ftyp`). É o mesmo valor que o upload de avatar já usava.
 */
const SIGNATURE_BYTES = 4100;

/**
 * Lê o cabeçalho do arquivo e devolve o MIME REAL, deduzido dos bytes.
 *
 * 🔴 Por que isto existe (UPL-1): `file.mimetype` do multer é o header
 * `Content-Type` que o **cliente escreveu** — é uma afirmação, não um fato. Um
 * `.exe` anunciado como `audio/mpeg` entrava no bucket e ia para o worker de
 * GPU. O caminho `from-source` já cheirava bytes (`safe-url-fetcher.ts`), o
 * avatar e o menu-PDF também; os uploads diretos de IA eram a exceção.
 *
 * ⚠️ **O vocabulário de MIME do `file-type` é o contrato.** Na v21 ele devolve
 * `audio/flac` (e não `audio/x-flac`), `audio/wav`, `audio/mpeg` e `audio/ogg`
 * — exatamente os valores de `AI_CIFRA_ALLOWED_MIME_TYPES` /
 * `AI_AUDIO_ALLOWED_MIME_TYPES`, por isso não há mapa de normalização aqui.
 * Ao subir a major do `file-type`, confira essa correspondência: se ele passar a
 * devolver `audio/x-flac`, FLAC legítimo começa a levar 422 e nenhum teste com
 * fixture `.mp3` perceberia. `detect-file-mime.spec.ts` fixa essa expectativa.
 *
 * @returns o MIME detectado, ou `null` quando os bytes não identificam formato
 *          conhecido (arquivo vazio, texto puro, formato exótico).
 */
export async function detectFileMime(filePath: string): Promise<string | null> {
  // Import dinâmico: `file-type` é ESM puro desde a v17 e este projeto compila
  // para CommonJS — `require` estático quebraria em runtime.
  const { fileTypeFromBuffer } = await import("file-type");

  const fd = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(SIGNATURE_BYTES);
    const { bytesRead } = await fd.read(buffer, 0, SIGNATURE_BYTES, 0);
    // `subarray` e não o buffer inteiro: arquivo menor que 4100 bytes deixaria
    // o resto preenchido com zeros, e zero é conteúdo que alguns detectores
    // interpretam.
    const detected = await fileTypeFromBuffer(buffer.subarray(0, bytesRead));
    return detected?.mime ?? null;
  } finally {
    await fd.close().catch(() => undefined);
  }
}

/**
 * `detectFileMime` + política: exige que o formato real esteja na allowlist.
 *
 * Usado onde a allowlist mora no próprio controller (avatar, capa, menu-PDF).
 * Nos uploads de IA a política é do use-case — ali o controller só chama
 * `detectFileMime` e entrega o tipo detectado como `content_type`, para que a
 * checagem que já existia passe a incidir sobre os bytes em vez da afirmação
 * do cliente.
 *
 * @returns o MIME detectado (já validado), para gravar no storage.
 */
export async function assertFileSignature(
  filePath: string,
  allowedMimes: readonly string[],
  message: string,
): Promise<string> {
  const detected = await detectFileMime(filePath);

  if (!detected || !allowedMimes.includes(detected)) {
    throw new UnprocessableEntityException(message);
  }

  return detected;
}
