import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable } from "@nestjs/common";
import { Cache } from "cache-manager";

@Injectable()
export class PaymentEventProcessingService {
  private static readonly KEY_PREFIX = "payment_event";
  private static readonly TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days — gorjetas têm janela maior

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async processOnce<T>(
    idempotencyKey: string,
    work: () => Promise<T>,
  ): Promise<T | null> {
    const key = `${PaymentEventProcessingService.KEY_PREFIX}:${idempotencyKey}`;
    const alreadyProcessed = await this.cache.get<boolean>(key);
    if (alreadyProcessed) {
      return null;
    }

    const result = await this.retry(work);
    await this.cache.set(key, true, PaymentEventProcessingService.TTL_SECONDS);
    return result;
  }

  private async retry<T>(work: () => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await work();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 50));
        }
      }
    }

    throw lastError;
  }
}
