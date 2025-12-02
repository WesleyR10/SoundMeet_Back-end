import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database-module/prisma/prisma.service";
import { DomainEventService } from "./domain-event.service";

@Injectable()
export class UnitOfWorkService {
  private readonly logger = new Logger(UnitOfWorkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventService: DomainEventService,
  ) {}

  /**
   * Execute operations within a database transaction
   */
  async execute<T>(
    operation: (prisma: PrismaService) => Promise<T>,
    options?: {
      isolationLevel?:
        | "ReadUncommitted"
        | "ReadCommitted"
        | "RepeatableRead"
        | "Serializable";
      timeout?: number;
    },
  ): Promise<T> {
    const startTime = Date.now();
    this.logger.debug("Starting transaction");

    try {
      const result = await this.prisma.$transaction(
        async (prisma) => {
          const result = await operation(prisma as PrismaService);

          // Publish domain events after successful transaction
          await this.domainEventService.publishPendingEvents();

          return result;
        },
        {
          isolationLevel: options?.isolationLevel,
          timeout: options?.timeout || 10000, // 10 seconds default
        },
      );

      const duration = Date.now() - startTime;
      this.logger.debug(`Transaction completed successfully in ${duration}ms`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Transaction failed after ${duration}ms:`, error);

      // Clear pending events on error
      this.domainEventService.clearPendingEvents();

      throw error;
    }
  }

  /**
   * Execute multiple operations in parallel within a transaction
   */
  async executeParallel<T extends readonly unknown[] | []>(
    operations: {
      [K in keyof T]: (prisma: PrismaService) => Promise<T[K]>;
    },
    options?: {
      isolationLevel?:
        | "ReadUncommitted"
        | "ReadCommitted"
        | "RepeatableRead"
        | "Serializable";
      timeout?: number;
    },
  ): Promise<T> {
    return this.execute(async (prisma) => {
      const promises = operations.map((operation) => operation(prisma));
      return Promise.all(promises) as Promise<T>;
    }, options);
  }

  /**
   * Execute operations in sequence within a transaction
   */
  async executeSequence<T>(
    operations: Array<
      (prisma: PrismaService, previousResults: any[]) => Promise<T>
    >,
    options?: {
      isolationLevel?:
        | "ReadUncommitted"
        | "ReadCommitted"
        | "RepeatableRead"
        | "Serializable";
      timeout?: number;
    },
  ): Promise<T[]> {
    return this.execute(async (prisma) => {
      const results: T[] = [];

      for (const operation of operations) {
        const result = await operation(prisma, results);
        results.push(result);
      }

      return results;
    }, options);
  }

  /**
   * Execute with retry logic
   */
  async executeWithRetry<T>(
    operation: (prisma: PrismaService) => Promise<T>,
    options?: {
      maxRetries?: number;
      retryDelay?: number;
      isolationLevel?:
        | "ReadUncommitted"
        | "ReadCommitted"
        | "RepeatableRead"
        | "Serializable";
      timeout?: number;
    },
  ): Promise<T> {
    const maxRetries = options?.maxRetries || 3;
    const retryDelay = options?.retryDelay || 1000;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(operation, {
          isolationLevel: options?.isolationLevel,
          timeout: options?.timeout,
        });
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          this.logger.error(
            `Transaction failed after ${maxRetries} attempts:`,
            error,
          );
          break;
        }

        // Check if error is retryable (e.g., deadlock, timeout)
        if (this.isRetryableError(error)) {
          this.logger.warn(
            `Transaction attempt ${attempt} failed, retrying in ${retryDelay}ms:`,
            error,
          );
          await this.delay(retryDelay * attempt); // Exponential backoff
        } else {
          this.logger.error("Non-retryable error occurred:", error);
          break;
        }
      }
    }

    throw lastError!;
  }

  private isRetryableError(error: any): boolean {
    // Check for common retryable database errors
    const retryableErrors = [
      "P2034", // Transaction conflict
      "P2028", // Transaction API error
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
    ];

    const errorMessage = error?.message || "";
    const errorCode = error?.code || "";

    return retryableErrors.some(
      (code) => errorMessage.includes(code) || errorCode.includes(code),
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
