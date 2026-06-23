import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { OnModuleDestroy } from "@nestjs/common";

import {
  ISyncedLyricsBulkDispatcher,
  SyncedLyricsBulkEnqueueCommand,
} from "../../core/synced-lyrics/application/ports/synced-lyrics-bulk-dispatcher.interface";
import { ProcessSyncedLyricsBulkItemUseCase } from "../../core/synced-lyrics/application/use-cases/process-synced-lyrics-bulk-item/process-synced-lyrics-bulk-item.use-case";
import { SYNCED_LYRICS_RABBITMQ } from "./rabbitmq/synced-lyrics.rabbitmq";

type SyncedLyricsDispatcherBackpressureConfig = {
  maxQueueSize: number;
  enqueueRetryDelayMs: number;
  tickDelayMs: number;
};

export class SyncedLyricsNoopDispatcher implements ISyncedLyricsBulkDispatcher {
  async enqueue(_command: SyncedLyricsBulkEnqueueCommand): Promise<void> {}
}

export class SyncedLyricsBulkInlineDispatcher
  implements ISyncedLyricsBulkDispatcher, OnModuleDestroy
{
  private queue: SyncedLyricsBulkEnqueueCommand[] = [];
  private queued = new Set<string>();
  private blockedByBackpressure = new Set<string>();
  private runningCount = 0;

  private destroyed = false;
  private timeouts = new Set<NodeJS.Timeout>();
  private tickTimer: NodeJS.Timeout | null = null;

  private readonly backpressure: SyncedLyricsDispatcherBackpressureConfig;

  constructor(
    private readonly processUseCase: ProcessSyncedLyricsBulkItemUseCase,
    private readonly concurrency: number,
    backpressure?: Partial<SyncedLyricsDispatcherBackpressureConfig>,
  ) {
    this.backpressure = {
      maxQueueSize: backpressure?.maxQueueSize ?? 500,
      enqueueRetryDelayMs: backpressure?.enqueueRetryDelayMs ?? 250,
      tickDelayMs: backpressure?.tickDelayMs ?? 250,
    };
  }

  onModuleDestroy() {
    this.destroyed = true;
    if (this.tickTimer) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
    for (const t of this.timeouts) {
      clearTimeout(t);
    }
    this.timeouts.clear();
    this.queue = [];
    this.queued.clear();
    this.blockedByBackpressure.clear();
  }

  async enqueue(command: SyncedLyricsBulkEnqueueCommand): Promise<void> {
    if (this.destroyed) {
      return;
    }

    const key = `${command.job_id}:${command.music_library_id}`;
    if (this.queued.has(key)) {
      return;
    }

    if (this.blockedByBackpressure.has(key)) {
      return;
    }

    if (this.queue.length >= this.backpressure.maxQueueSize) {
      this.blockedByBackpressure.add(key);
      const jitter = Math.floor(Math.random() * 250);
      this.scheduleTimeout(() => {
        this.blockedByBackpressure.delete(key);
        void this.enqueue(command);
      }, this.backpressure.enqueueRetryDelayMs + jitter);
      return;
    }

    this.queued.add(key);
    this.queue.push(command);
    this.tick();
  }

  private tick(): void {
    if (this.destroyed) {
      return;
    }

    while (this.runningCount < this.concurrency && this.queue.length > 0) {
      const command = this.queue.shift()!;
      const key = `${command.job_id}:${command.music_library_id}`;
      this.runningCount += 1;

      void this.processUseCase
        .execute({
          job_id: command.job_id,
          musician_id: command.musician_id,
          music_library_id: command.music_library_id,
          force: command.force,
        } as any)
        .catch(() => undefined)
        .finally(() => {
          this.runningCount -= 1;
          this.queued.delete(key);
          this.scheduleTick(this.backpressure.tickDelayMs);
        });
    }
  }

  private scheduleTick(delayMs: number): void {
    if (this.destroyed) {
      return;
    }
    if (this.tickTimer) {
      return;
    }
    this.tickTimer = this.scheduleTimeout(() => {
      this.tickTimer = null;
      this.tick();
    }, delayMs);
  }

  private scheduleTimeout(fn: () => void, delayMs: number): NodeJS.Timeout {
    const t = setTimeout(() => {
      this.timeouts.delete(t);
      fn();
    }, delayMs);
    this.timeouts.add(t);
    return t;
  }
}

export class SyncedLyricsRabbitmqDispatcher implements ISyncedLyricsBulkDispatcher {
  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly routingKey: string,
  ) {}

  async enqueue(command: SyncedLyricsBulkEnqueueCommand): Promise<void> {
    await this.amqpConnection.publish(
      SYNCED_LYRICS_RABBITMQ.exchange,
      this.routingKey,
      command,
      {
        messageId: `${command.job_id}:${command.music_library_id}`,
        persistent: true,
      },
    );
  }
}
