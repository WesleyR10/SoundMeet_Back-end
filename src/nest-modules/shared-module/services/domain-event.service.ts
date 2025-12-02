import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { IDomainEvent } from "@core/shared/domain/events/domain-event.interface";

@Injectable()
export class DomainEventService {
  private readonly logger = new Logger(DomainEventService.name);
  private pendingEvents: IDomainEvent[] = [];

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Add event to pending list (will be published after transaction commits)
   */
  addEvent(event: IDomainEvent): void {
    this.pendingEvents.push(event);
    this.logger.debug(`Event added to pending list: ${event.constructor.name}`);
  }

  /**
   * Add multiple events to pending list
   */
  addEvents(events: IDomainEvent[]): void {
    this.pendingEvents.push(...events);
    this.logger.debug(`${events.length} events added to pending list`);
  }

  /**
   * Publish event immediately (use with caution)
   */
  async publishNow(event: IDomainEvent): Promise<void> {
    try {
      this.logger.debug(
        `Publishing event immediately: ${event.constructor.name}`,
      );
      await this.eventEmitter.emitAsync(event.constructor.name, event);
      this.logger.debug(
        `Event published successfully: ${event.constructor.name}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish event ${event.constructor.name}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Publish all pending events (called after successful transaction)
   */
  async publishPendingEvents(): Promise<void> {
    if (this.pendingEvents.length === 0) {
      return;
    }

    const eventsToPublish = [...this.pendingEvents];
    this.pendingEvents = [];

    this.logger.debug(`Publishing ${eventsToPublish.length} pending events`);

    const publishPromises = eventsToPublish.map(async (event) => {
      try {
        await this.eventEmitter.emitAsync(event.constructor.name, event);
        this.logger.debug(`Event published: ${event.constructor.name}`);
      } catch (error) {
        this.logger.error(
          `Failed to publish event ${event.constructor.name}:`,
          error,
        );
        // Don't throw here to avoid breaking other events
        // Consider implementing a dead letter queue for failed events
      }
    });

    await Promise.allSettled(publishPromises);
    this.logger.debug("All pending events processed");
  }

  /**
   * Clear pending events (called on transaction rollback)
   */
  clearPendingEvents(): void {
    const count = this.pendingEvents.length;
    this.pendingEvents = [];

    if (count > 0) {
      this.logger.debug(`Cleared ${count} pending events`);
    }
  }

  /**
   * Get count of pending events
   */
  getPendingEventsCount(): number {
    return this.pendingEvents.length;
  }

  /**
   * Get pending events (for debugging)
   */
  getPendingEvents(): readonly IDomainEvent[] {
    return [...this.pendingEvents];
  }

  /**
   * Subscribe to domain events
   */
  subscribe<T extends IDomainEvent>(
    eventName: string,
    handler: (event: T) => Promise<void> | void,
  ): void {
    this.eventEmitter.on(eventName, handler);
    this.logger.debug(`Subscribed to event: ${eventName}`);
  }

  /**
   * Unsubscribe from domain events
   */
  unsubscribe(eventName: string, handler: (event: IDomainEvent) => Promise<void> | void): void {
    this.eventEmitter.off(eventName, handler as any);
    this.logger.debug(`Unsubscribed from event: ${eventName}`);
  }

  /**
   * Publish event with retry logic
   */
  async publishWithRetry(
    event: IDomainEvent,
    options?: {
      maxRetries?: number;
      retryDelay?: number;
    },
  ): Promise<void> {
    const maxRetries = options?.maxRetries || 3;
    const retryDelay = options?.retryDelay || 1000;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.publishNow(event);
        return;
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          this.logger.error(
            `Failed to publish event ${event.constructor.name} after ${maxRetries} attempts:`,
            error,
          );
          break;
        }

        this.logger.warn(
          `Event publish attempt ${attempt} failed, retrying in ${retryDelay}ms:`,
          error,
        );
        await this.delay(retryDelay * attempt);
      }
    }

    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
