import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable } from "@nestjs/common";
import { Cache } from "cache-manager";

@Injectable()
export class RequestEventProcessingService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async processOnce<T>(
    idempotencyKey: string,
    work: () => Promise<T>,
  ): Promise<T | null> {
    const key = `request_event:${idempotencyKey}`;
    const alreadyProcessed = await this.cache.get<boolean>(key);
    if (alreadyProcessed) {
      return null;
    }

    const result = await this.retry(work);
    await this.cache.set(key, true, 60 * 60 * 24);
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
          await this.sleep(attempt * 50);
        }
      }
    }

    throw lastError;
  }

  private async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
