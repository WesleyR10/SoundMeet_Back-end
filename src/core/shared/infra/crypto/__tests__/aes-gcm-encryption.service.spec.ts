import { randomBytes } from "crypto";

import { AesGcmEncryptionService } from "../aes-gcm-encryption.service";
import { FakeEncryptionService } from "../fake-encryption.service";

const validKey = () => randomBytes(32).toString("base64");

describe("AesGcmEncryptionService", () => {
  it("faz round-trip encrypt → decrypt", () => {
    const service = new AesGcmEncryptionService(validKey());

    const payload = service.encrypt("refresh-token-super-secreto");

    expect(service.decrypt(payload)).toBe("refresh-token-super-secreto");
  });

  it("gera IV único a cada chamada (nunca reutiliza)", () => {
    const service = new AesGcmEncryptionService(validKey());

    const first = service.encrypt("mesmo-valor");
    const second = service.encrypt("mesmo-valor");

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("detecta adulteração do ciphertext", () => {
    const service = new AesGcmEncryptionService(validKey());
    const payload = service.encrypt("valor");

    const tampered = Buffer.from(payload.ciphertext, "base64");
    tampered[0] = tampered[0] ^ 0xff;

    expect(() =>
      service.decrypt({ ...payload, ciphertext: tampered.toString("base64") }),
    ).toThrow();
  });

  it("detecta adulteração do authTag", () => {
    const service = new AesGcmEncryptionService(validKey());
    const payload = service.encrypt("valor");

    const tampered = Buffer.from(payload.authTag, "base64");
    tampered[0] = tampered[0] ^ 0xff;

    expect(() =>
      service.decrypt({ ...payload, authTag: tampered.toString("base64") }),
    ).toThrow();
  });

  it("falha ao decifrar com chave diferente", () => {
    const serviceA = new AesGcmEncryptionService(validKey());
    const serviceB = new AesGcmEncryptionService(validKey());

    const payload = serviceA.encrypt("valor");

    expect(() => serviceB.decrypt(payload)).toThrow();
  });

  it("rejeita chave ausente na construção (fail-fast na subida)", () => {
    expect(() => new AesGcmEncryptionService("")).toThrow(
      /TOKEN_ENCRYPTION_KEY ausente/,
    );
  });

  it("rejeita chave com tamanho errado", () => {
    const shortKey = randomBytes(16).toString("base64");
    expect(() => new AesGcmEncryptionService(shortKey)).toThrow(
      /esperado 32 bytes/,
    );
  });
});

describe("FakeEncryptionService", () => {
  it("faz round-trip reversível e registra chamadas", () => {
    const fake = new FakeEncryptionService();

    const payload = fake.encrypt("token");

    expect(fake.decrypt(payload)).toBe("token");
    expect(fake.encrypted).toEqual(["token"]);
    expect(fake.decrypted).toHaveLength(1);
  });
});
