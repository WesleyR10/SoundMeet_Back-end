import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import {
  IContractSignatureChallenge,
  InvalidSignatureChallengeError,
  IssuedSignatureChallenge,
  SignatureChallengeKey,
} from "../../application/ports/contract-signature-challenge.port";

/** Só o necessário do `Cache` do cache-manager — evita acoplar a porta ao pacote. */
export type ChallengeStore = {
  get<T>(key: string): Promise<T | undefined | null>;
  set(key: string, value: unknown, ttl?: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
};

type StoredChallenge = {
  code_hash: string;
  attempts: number;
  expires_at: number;
};

/**
 * Segundo fator em cache (Redis em produção, memória em teste).
 *
 * ## Três decisões que valem registro
 *
 * **Guarda um HMAC, não o código.** Um dump do Redis, um log de debug ou um
 * backup não revelam códigos vivos. E é HMAC com segredo do servidor, não
 * hash puro: o espaço de um código de 6 dígitos é de 1 milhão, então um
 * SHA-256 sem chave cai numa tabela pré-computada em segundos — quem
 * vazasse o cache leria os códigos. Com a chave, o dump sozinho não basta.
 * O custo é o mesmo.
 *
 * **Comparação em tempo constante.** Códigos de 6 dígitos são um espaço
 * pequeno; `===` sobre string vaza o prefixo correto pelo tempo de resposta.
 * Como os dois lados são hashes de 64 hex, o `timingSafeEqual` opera sempre
 * sobre buffers do mesmo tamanho e não precisa de guarda de comprimento.
 *
 * **Tentativas contadas e limitadas.** Sem limite, 6 dígitos caem em minutos.
 * Ao estourar o teto o registro é apagado, e não apenas bloqueado: o caminho
 * de quem errou 5 vezes é pedir um código novo.
 *
 * ⚠️ **TTL em MILISSEGUNDOS.** `cache-manager` 5+ mudou a unidade, e o resto
 * do repositório já foi mordido por isso. `CHALLENGE_TTL_MS` deixa a unidade no
 * nome.
 */
export const CHALLENGE_TTL_MS = 10 * 60 * 1000;
export const CHALLENGE_MAX_ATTEMPTS = 5;
const CODE_DIGITS = 6;

export class CacheSignatureChallengeProvider implements IContractSignatureChallenge {
  /**
   * `secret` é o segredo do HMAC (`CONTRACT_CHALLENGE_SECRET`). Vazio é
   * aceito em desenvolvimento — e só ali: o Joi o exige em produção.
   */
  constructor(
    private readonly store: ChallengeStore,
    private readonly secret: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async issue(key: SignatureChallengeKey): Promise<IssuedSignatureChallenge> {
    /*
     * `randomInt` do node:crypto, não `Math.random()`: o código é o segundo
     * fator de um instrumento probatório, e PRNG previsível o tornaria
     * decorativo.
     */
    const code = String(randomInt(0, 10 ** CODE_DIGITS)).padStart(
      CODE_DIGITS,
      "0",
    );
    const expiresAt = new Date(this.now().getTime() + CHALLENGE_TTL_MS);

    const stored: StoredChallenge = {
      code_hash: this.hash(code),
      attempts: 0,
      expires_at: expiresAt.getTime(),
    };

    // Sobrescrever invalida o código anterior — reemitir é o caminho de quem
    // não recebeu, e dois códigos vivos dobrariam a superfície de tentativa.
    await this.store.set(this.cacheKey(key), stored, CHALLENGE_TTL_MS);

    return { code, expires_at: expiresAt };
  }

  async consume(key: SignatureChallengeKey, code: string): Promise<void> {
    const cacheKey = this.cacheKey(key);
    const stored = await this.store.get<StoredChallenge>(cacheKey);

    if (!stored) {
      throw new InvalidSignatureChallengeError();
    }

    /*
     * O TTL do cache já expiraria o registro, mas a checagem explícita existe
     * porque nem todo store honra TTL com a mesma precisão — e um código
     * expirado que ainda funciona é exatamente o tipo de falha silenciosa que
     * ninguém percebe.
     */
    if (stored.expires_at <= this.now().getTime()) {
      await this.store.del(cacheKey);
      throw new InvalidSignatureChallengeError();
    }

    if (!this.matches(code, stored.code_hash)) {
      const attempts = stored.attempts + 1;

      if (attempts >= CHALLENGE_MAX_ATTEMPTS) {
        await this.store.del(cacheKey);
      } else {
        const remainingTtl = stored.expires_at - this.now().getTime();
        await this.store.set(
          cacheKey,
          { ...stored, attempts },
          Math.max(remainingTtl, 1),
        );
      }

      throw new InvalidSignatureChallengeError();
    }

    // Uso único: apagar ANTES de devolver o controle impede que uma resposta
    // capturada seja reenviada.
    await this.store.del(cacheKey);
  }

  private hash(code: string): string {
    return createHmac("sha256", this.secret).update(code).digest("hex");
  }

  private matches(code: string, expectedHash: string): boolean {
    const candidate = Buffer.from(this.hash(code), "hex");
    const expected = Buffer.from(expectedHash, "hex");

    // Os dois lados são HMAC-SHA-256, então o comprimento é sempre 32 bytes e
    // `timingSafeEqual` nunca lança por tamanho diferente. A guarda existe
    // para o caso de um registro corrompido no cache.
    if (candidate.length !== expected.length) return false;

    return timingSafeEqual(candidate, expected);
  }

  private cacheKey(key: SignatureChallengeKey): string {
    return [
      "contract-signature-challenge",
      key.contract_id,
      key.role,
      key.signer_user_id,
    ].join(":");
  }
}
