import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import {
  EncryptedPayload,
  IEncryptionService,
} from "../../domain/encryption.service";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

/**
 * AES-256-GCM com IV aleatório de 12 bytes por chamada (nunca reutilizado) e
 * auth tag de 16 bytes — adulteração de qualquer componente falha o decrypt.
 *
 * A chave vem de env var (`TOKEN_ENCRYPTION_KEY`, 32 bytes em base64) e é
 * validada no construtor — instanciação com chave inválida falha na subida
 * da aplicação, nunca silenciosamente em runtime.
 */
export class AesGcmEncryptionService implements IEncryptionService {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    if (!base64Key || !base64Key.trim()) {
      throw new Error(
        "TOKEN_ENCRYPTION_KEY ausente — gere com: openssl rand -base64 32",
      );
    }
    const key = Buffer.from(base64Key.trim(), "base64");
    if (key.length !== KEY_LENGTH_BYTES) {
      throw new Error(
        `TOKEN_ENCRYPTION_KEY inválida: esperado ${KEY_LENGTH_BYTES} bytes em base64, recebido ${key.length}`,
      );
    }
    this.key = key;
  }

  encrypt(plaintext: string): EncryptedPayload {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    return {
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
    };
  }

  decrypt(payload: EncryptedPayload): string {
    const iv = Buffer.from(payload.iv, "base64");
    const authTag = Buffer.from(payload.authTag, "base64");
    const decipher = createDecipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }
}
