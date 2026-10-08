import { createHash } from "node:crypto";

import { InvalidSignatureChallengeError } from "../../../application/ports/contract-signature-challenge.port";
import {
  CacheSignatureChallengeProvider,
  CHALLENGE_MAX_ATTEMPTS,
  CHALLENGE_TTL_MS,
  ChallengeStore,
} from "../cache-signature-challenge.provider";

class MapStore implements ChallengeStore {
  readonly map = new Map<string, unknown>();
  readonly ttls: number[] = [];

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<unknown> {
    if (ttl !== undefined) this.ttls.push(ttl);
    this.map.set(key, value);
    return value;
  }

  async del(key: string): Promise<unknown> {
    return this.map.delete(key);
  }
}

const KEY = {
  contract_id: "11111111-1111-4111-8111-111111111111",
  role: "contracted" as const,
  signer_user_id: "22222222-2222-4222-8222-222222222222",
};

describe("CacheSignatureChallengeProvider", () => {
  let store: MapStore;
  let now: Date;
  let provider: CacheSignatureChallengeProvider;

  beforeEach(() => {
    store = new MapStore();
    now = new Date("2026-08-15T14:00:00Z");
    provider = new CacheSignatureChallengeProvider(
      store,
      "test-challenge-secret",
      () => now,
    );
  });

  describe("emissão", () => {
    it("emite código de 6 dígitos com validade de 10 minutos", async () => {
      const { code, expires_at } = await provider.issue(KEY);

      expect(code).toMatch(/^\d{6}$/);
      expect(expires_at.getTime()).toBe(now.getTime() + CHALLENGE_TTL_MS);
    });

    /*
     * ⚠️ `cache-manager` 5+ passou a contar TTL em MILISSEGUNDOS. Este teste
     * existe porque o repositório já foi mordido por essa mudança: 600 em vez
     * de 600000 daria um código que expira em 0,6 segundo, e o sintoma
     * ("o código nunca funciona") não aponta para a unidade.
     */
    it("passa o TTL ao store em milissegundos", async () => {
      await provider.issue(KEY);

      expect(store.ttls[0]).toBe(600_000);
    });

    // Dump do Redis, log ou backup não podem revelar código vivo.
    it("nunca guarda o código em claro", async () => {
      const { code } = await provider.issue(KEY);

      expect(JSON.stringify([...store.map.values()])).not.toContain(code);
    });

    it("reemitir invalida o código anterior", async () => {
      const primeiro = await provider.issue(KEY);
      await provider.issue(KEY);

      await expect(provider.consume(KEY, primeiro.code)).rejects.toThrow(
        InvalidSignatureChallengeError,
      );
    });
  });

  describe("consumo", () => {
    it("aceita o código correto", async () => {
      const { code } = await provider.issue(KEY);

      await expect(provider.consume(KEY, code)).resolves.toBeUndefined();
    });

    // Uso único: uma resposta HTTP capturada não pode ser reenviada.
    it("recusa o mesmo código duas vezes", async () => {
      const { code } = await provider.issue(KEY);
      await provider.consume(KEY, code);

      await expect(provider.consume(KEY, code)).rejects.toThrow(
        InvalidSignatureChallengeError,
      );
    });

    it("recusa código errado", async () => {
      const { code } = await provider.issue(KEY);
      const errado = code === "000000" ? "111111" : "000000";

      await expect(provider.consume(KEY, errado)).rejects.toThrow(
        InvalidSignatureChallengeError,
      );
    });

    it("recusa quando nunca houve emissão", async () => {
      await expect(provider.consume(KEY, "123456")).rejects.toThrow(
        InvalidSignatureChallengeError,
      );
    });

    it("recusa depois de expirado", async () => {
      const { code } = await provider.issue(KEY);
      now = new Date(now.getTime() + CHALLENGE_TTL_MS + 1);

      await expect(provider.consume(KEY, code)).rejects.toThrow(
        InvalidSignatureChallengeError,
      );
    });

    /*
     * Sem teto, 6 dígitos caem em minutos de força bruta. Ao estourar, o
     * registro é APAGADO e não apenas bloqueado — o caminho de quem errou é
     * pedir outro código.
     */
    it("invalida o código após o limite de tentativas", async () => {
      const { code } = await provider.issue(KEY);
      const errado = code === "000000" ? "111111" : "000000";

      for (let i = 0; i < CHALLENGE_MAX_ATTEMPTS; i++) {
        await expect(provider.consume(KEY, errado)).rejects.toThrow(
          InvalidSignatureChallengeError,
        );
      }

      // Nem o código CERTO funciona depois disso.
      await expect(provider.consume(KEY, code)).rejects.toThrow(
        InvalidSignatureChallengeError,
      );
      expect(store.map.size).toBe(0);
    });
  });

  describe("isolamento entre chaves", () => {
    // O código do contratante não pode assinar pelo contratado, e vice-versa.
    it("não aceita código emitido para o outro papel", async () => {
      const { code } = await provider.issue(KEY);

      await expect(
        provider.consume({ ...KEY, role: "contractor" }, code),
      ).rejects.toThrow(InvalidSignatureChallengeError);
    });

    it("não aceita código emitido para outro signatário", async () => {
      const { code } = await provider.issue(KEY);

      await expect(
        provider.consume({ ...KEY, signer_user_id: "outro" }, code),
      ).rejects.toThrow(InvalidSignatureChallengeError);
    });

    it("não aceita código emitido para outro contrato", async () => {
      const { code } = await provider.issue(KEY);

      await expect(
        provider.consume({ ...KEY, contract_id: "outro-contrato" }, code),
      ).rejects.toThrow(InvalidSignatureChallengeError);
    });
  });

  /**
   * O que separa "guardar o hash" de "guardar um HMAC".
   *
   * Um código de 6 dígitos tem 1 milhão de possibilidades: com SHA-256 sem
   * chave, quem lesse o cache converteria os registros em códigos vivos com
   * uma tabela pré-computada. Estes dois testes provam que o segredo entra na
   * conta — o registro em repouso não determina o código sozinho.
   */
  describe("HMAC com segredo do servidor", () => {
    it("não guarda o código em claro nem o hash sem chave", async () => {
      const { code } = await provider.issue(KEY);
      const stored = JSON.stringify([...store.map.values()]);

      expect(stored).not.toContain(code);
      // O hash sem chave do mesmo código não aparece no que foi persistido.
      const unkeyed = createHash("sha256").update(code).digest("hex");
      expect(stored).not.toContain(unkeyed);
    });

    it("um provider com outro segredo recusa o mesmo código", async () => {
      const { code } = await provider.issue(KEY);

      const outroSegredo = new CacheSignatureChallengeProvider(
        store,
        "segredo-diferente",
        () => now,
      );

      await expect(outroSegredo.consume(KEY, code)).rejects.toThrow(
        InvalidSignatureChallengeError,
      );
    });
  });
});
