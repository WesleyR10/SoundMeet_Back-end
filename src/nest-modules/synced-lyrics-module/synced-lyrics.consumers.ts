import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, UseFilters, ValidationPipe } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

import { ProcessSyncedLyricsBulkItemInputValidator } from "../../core/synced-lyrics/application/use-cases/process-synced-lyrics-bulk-item/process-synced-lyrics-bulk-item.input";
import { ProcessSyncedLyricsBulkItemUseCase } from "../../core/synced-lyrics/application/use-cases/process-synced-lyrics-bulk-item/process-synced-lyrics-bulk-item.use-case";
import { RabbitmqConsumeErrorFilter } from "../rabbitmq-module/rabbitmq-consume-error/rabbitmq-consume-error.filter";
import { SYNCED_LYRICS_RABBITMQ } from "./rabbitmq/synced-lyrics.rabbitmq";

const BULK_JOB_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`SyncedLyricsBulkJob timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

@UseFilters(RabbitmqConsumeErrorFilter)
@Injectable()
export class SyncedLyricsBulkRequestedConsumer {
  constructor(private moduleRef: ModuleRef) {}

  @RabbitSubscribe({
    exchange: SYNCED_LYRICS_RABBITMQ.exchange,
    routingKey: SYNCED_LYRICS_RABBITMQ.routingKeys.bulkRequested,
    queue: SYNCED_LYRICS_RABBITMQ.queues.bulkRequested,
    allowNonJsonMessages: false,
    queueOptions: {
      durable: true,
      deadLetterExchange: SYNCED_LYRICS_RABBITMQ.dlxExchange,
      deadLetterRoutingKey: SYNCED_LYRICS_RABBITMQ.routingKeys.bulkRequested,
      channel: SYNCED_LYRICS_RABBITMQ.channel,
    },
  })
  async onBulkRequested(msg: {
    job_id?: string;
    musician_id?: string;
    music_library_id?: string;
    force?: boolean;
  }) {
    const input = new ProcessSyncedLyricsBulkItemInputValidator({
      job_id: `${msg?.job_id ?? ""}`,
      musician_id: `${msg?.musician_id ?? ""}`,
      music_library_id: `${msg?.music_library_id ?? ""}`,
      force: Boolean(msg?.force),
    });

    await new ValidationPipe({
      errorHttpStatusCode: 422,
    }).transform(input, {
      metatype: ProcessSyncedLyricsBulkItemInputValidator,
      type: "body",
    });

    const useCase = await this.moduleRef.resolve(
      ProcessSyncedLyricsBulkItemUseCase,
    );

    await withTimeout(
      useCase.execute({
        job_id: input.job_id,
        musician_id: input.musician_id,
        music_library_id: input.music_library_id,
        force: input.force,
      } as any),
      BULK_JOB_TIMEOUT_MS,
    );
  }
}
