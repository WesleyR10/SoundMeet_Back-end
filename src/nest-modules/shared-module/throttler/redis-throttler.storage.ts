import { Logger } from "@nestjs/common";
import { ThrottlerStorage } from "@nestjs/throttler";
import { createClient, RedisClientType } from "redis";

/**
 * Espelha `ThrottlerStorageRecord` do `@nestjs/throttler` — que só é exportado
 * de um subpath interno (`dist/...`). Estruturalmente idêntico, então
 * `implements ThrottlerStorage` continua válido sem depender de caminho privado
 * do pacote.
 */
type ThrottlerStorageRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

/**
 * Storage de rate limit em Redis — para o limite valer em CLUSTER.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O PROBLEMA (Docs/audits/security-review-2026-08-28.md, A3)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O `ThrottlerModule` sem `storage` usa o armazenamento EM MEMÓRIA do processo.
 * Com mais de uma instância do NestJS — e o app já escala Socket.io
 * horizontalmente via Redis adapter — cada instância tem o seu próprio balde: o
 * limite efetivo vira `limit × Nº de instâncias`, e um reinício zera tudo. Um
 * rate limit que não é compartilhado não limita o que importa.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ALGORITMO: janela fixa + bloqueio, tudo num script Lua ATÔMICO
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `INCR` + `PEXPIRE` num único `EVAL` — sem corrida entre contar e expirar (o
 * caso clássico do INCR que nunca ganha TTL porque o processo caiu no meio). É
 * janela fixa, não a deslizante-por-hit do storage em memória; é o modelo
 * padrão de rate limit distribuído e tem a vantagem de ser determinístico.
 *
 * `timeToExpire`/`timeToBlockExpire` saem em SEGUNDOS (arredondados para cima),
 * espelhando o contrato do `ThrottlerStorageService` oficial — o `PTTL` do
 * Redis vem em ms.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 FAIL-OPEN: se o Redis cai, o rate limit AFROUXA, nunca DERRUBA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Rate limit é defesa secundária. Um erro de storage que virasse 500 tornaria a
 * indisponibilidade do Redis numa indisponibilidade do produto inteiro — troca
 * ruim. Qualquer falha (sem conexão, `EVAL` que estoura) devolve um registro
 * que não bloqueia; o request passa e o log registra. A defesa primária de cada
 * rota (auth, ownership, invariantes de domínio) continua de pé.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly client: RedisClientType;
  private ready = false;

  /**
   * Janela fixa + bloqueio, atômico.
   *
   * KEYS[1] = contador de hits · KEYS[2] = marcador de bloqueio
   * ARGV[1] = ttl(ms) · ARGV[2] = limit · ARGV[3] = blockDuration(ms)
   * Retorna: { totalHits, hitPTTL(ms), isBlocked(0|1), blockPTTL(ms) }
   */
  private static readonly SCRIPT = `
    local hitKey = KEYS[1]
    local blockKey = KEYS[2]
    local ttl = tonumber(ARGV[1])
    local limit = tonumber(ARGV[2])
    local blockDuration = tonumber(ARGV[3])

    -- Já bloqueado: não conta hit, só reporta quanto falta do bloqueio.
    local blockPTTL = redis.call('PTTL', blockKey)
    if blockPTTL > 0 then
      local curHits = tonumber(redis.call('GET', hitKey) or '0')
      local hPTTL = redis.call('PTTL', hitKey)
      if hPTTL < 0 then hPTTL = 0 end
      return {curHits, hPTTL, 1, blockPTTL}
    end

    local hits = redis.call('INCR', hitKey)
    if hits == 1 then
      redis.call('PEXPIRE', hitKey, ttl)
    end
    local hitPTTL = redis.call('PTTL', hitKey)
    if hitPTTL < 0 then
      redis.call('PEXPIRE', hitKey, ttl)
      hitPTTL = ttl
    end

    local isBlocked = 0
    local blockTTL = 0
    if hits > limit then
      isBlocked = 1
      redis.call('SET', blockKey, '1', 'PX', blockDuration)
      blockTTL = blockDuration
    end

    return {hits, hitPTTL, isBlocked, blockTTL}
  `;

  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl });
    this.client.on("error", (error) => {
      // Um handler é obrigatório: sem ele, um erro de socket vira exceção não
      // tratada que derruba o processo. Aqui só rebaixa para fail-open.
      this.ready = false;
      this.logger.warn(
        JSON.stringify({
          event: "throttler.redis.error",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    });
    this.client.on("ready", () => {
      this.ready = true;
    });

    // Conecta em background: os primeiros requests até conectar caem em
    // fail-open, o que dura milissegundos no boot.
    this.client.connect().catch((error) => {
      this.logger.error(
        JSON.stringify({
          event: "throttler.redis.connect_failed",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (!this.ready) {
      return RedisThrottlerStorage.allow();
    }

    try {
      const hitKey = `throttle:${throttlerName}:${key}`;
      const blockKey = `throttle:block:${throttlerName}:${key}`;

      const result = (await this.client.eval(RedisThrottlerStorage.SCRIPT, {
        keys: [hitKey, blockKey],
        arguments: [String(ttl), String(limit), String(blockDuration)],
      })) as [number, number, number, number];

      const [totalHits, hitPTTL, isBlocked, blockPTTL] = result;

      return {
        totalHits: Number(totalHits),
        timeToExpire: Math.ceil(Number(hitPTTL) / 1000),
        isBlocked: Number(isBlocked) === 1,
        timeToBlockExpire: Math.ceil(Number(blockPTTL) / 1000),
      };
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "throttler.redis.increment_failed",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
      return RedisThrottlerStorage.allow();
    }
  }

  /** Registro que nunca bloqueia — a resposta de fail-open. */
  private static allow(): ThrottlerStorageRecord {
    return {
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      // Encerramento best-effort; o processo está saindo de qualquer forma.
    }
  }
}
