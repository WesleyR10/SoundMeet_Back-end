import { Injectable, Logger, Inject } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTTL = 300; // 5 minutes

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get value from cache
   */
  async get<T>(key: string, namespace?: string): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const value = await this.cacheManager.get<T>(fullKey);

      if (value !== undefined) {
        this.logger.debug(`Cache HIT for key: ${fullKey}`);
        return value;
      }

      this.logger.debug(`Cache MISS for key: ${fullKey}`);
      return null;
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const ttl = (options?.ttl || this.defaultTTL) * 1000; // Convert to milliseconds

      await this.cacheManager.set(fullKey, value, ttl);
      this.logger.debug(`Cache SET for key: ${fullKey}, TTL: ${ttl}ms`);
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}:`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string, namespace?: string): Promise<void> {
    try {
      const fullKey = this.buildKey(key, namespace);
      await this.cacheManager.del(fullKey);
      this.logger.debug(`Cache DEL for key: ${fullKey}`);
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}:`, error);
    }
  }

  /**
   * Clear all cache or by pattern
   */
  async clear(pattern?: string): Promise<void> {
    try {
      if (pattern) {
        // For Redis, we would need to implement pattern-based deletion
        // For now, we'll just reset the entire cache
        this.logger.warn(
          "Pattern-based cache clearing not implemented, clearing all cache",
        );
      }

      await this.cacheManager.reset();
      this.logger.debug("Cache cleared");
    } catch (error) {
      this.logger.error("Error clearing cache:", error);
    }
  }

  /**
   * Get or set pattern - if key exists, return it, otherwise set and return new value
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key, options?.namespace);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);

    return value;
  }

  /**
   * Increment a numeric value in cache
   */
  async increment(
    key: string,
    amount = 1,
    options?: CacheOptions,
  ): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const current = (await this.get<number>(fullKey)) || 0;
      const newValue = current + amount;

      await this.set(fullKey, newValue, options);
      return newValue;
    } catch (error) {
      this.logger.error(`Error incrementing cache key ${key}:`, error);
      return amount;
    }
  }

  /**
   * Decrement a numeric value in cache
   */
  async decrement(
    key: string,
    amount = 1,
    options?: CacheOptions,
  ): Promise<number> {
    return this.increment(key, -amount, options);
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, namespace?: string): Promise<boolean> {
    const value = await this.get(key, namespace);
    return value !== null;
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(
    keyValuePairs: Record<string, any>,
    options?: CacheOptions,
  ): Promise<void> {
    const promises = Object.entries(keyValuePairs).map(([key, value]) =>
      this.set(key, value, options),
    );

    await Promise.all(promises);
  }

  /**
   * Get multiple values by keys
   */
  async mget<T>(
    keys: string[],
    namespace?: string,
  ): Promise<Record<string, T | null>> {
    const promises = keys.map(async (key) => {
      const value = await this.get<T>(key, namespace);
      return { key, value };
    });

    const results = await Promise.all(promises);

    return results.reduce(
      (acc, { key, value }) => {
        acc[key] = value;
        return acc;
      },
      {} as Record<string, T | null>,
    );
  }

  /**
   * Cache with tags for easier invalidation
   */
  async setWithTags<T>(
    key: string,
    value: T,
    tags: string[],
    options?: CacheOptions,
  ): Promise<void> {
    await this.set(key, value, options);

    // Store tag associations
    for (const tag of tags) {
      const tagKey = this.buildTagKey(tag);
      const taggedKeys = (await this.get<string[]>(tagKey)) || [];

      if (!taggedKeys.includes(key)) {
        taggedKeys.push(key);
        await this.set(tagKey, taggedKeys, { ttl: options?.ttl });
      }
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = this.buildTagKey(tag);
      const taggedKeys = (await this.get<string[]>(tagKey)) || [];

      // Delete all keys associated with this tag
      const deletePromises = taggedKeys.map((key) => this.del(key));
      await Promise.all(deletePromises);

      // Delete the tag key itself
      await this.del(tagKey);
    }
  }

  /**
   * Build full cache key with namespace
   */
  private buildKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  /**
   * Build tag key for cache invalidation
   */
  private buildTagKey(tag: string): string {
    return `tag:${tag}`;
  }

  /**
   * Get cache statistics (if supported by the cache store)
   */
  async getStats(): Promise<any> {
    try {
      // This would depend on the cache store implementation
      // For Redis, we could get info, for memory cache, we could track hits/misses
      return {
        message: "Cache statistics not implemented for current store",
      };
    } catch (error) {
      this.logger.error("Error getting cache stats:", error);
      return null;
    }
  }
}
