import {
  EncryptedPayload,
  IEncryptionService,
} from "../../domain/encryption.service";

/**
 * Fake reversível para testes — round-trip via base64, sem criptografia real,
 * sem chave. Espelha o papel do `FakeGeocodingService`.
 */
export class FakeEncryptionService implements IEncryptionService {
  readonly encrypted: string[] = [];
  readonly decrypted: EncryptedPayload[] = [];

  encrypt(plaintext: string): EncryptedPayload {
    this.encrypted.push(plaintext);
    return {
      ciphertext: Buffer.from(plaintext, "utf8").toString("base64"),
      iv: "fake-iv",
      authTag: "fake-auth-tag",
    };
  }

  decrypt(payload: EncryptedPayload): string {
    this.decrypted.push(payload);
    return Buffer.from(payload.ciphertext, "base64").toString("utf8");
  }
}
