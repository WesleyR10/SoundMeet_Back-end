import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { ConfigService } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import { Cache } from "cache-manager";

import { IChordSheetReadModel } from "../../core/synced-lyrics/application/gateways/chord-sheet-read-model.interface";
import { IChordSheetWriteModel } from "../../core/synced-lyrics/application/gateways/chord-sheet-write-model.interface";
import { IRenderableChordSheetReadModel } from "../../core/synced-lyrics/application/gateways/renderable-chord-sheet-read-model.interface";
import { IRenderableChordSheetWriteModel } from "../../core/synced-lyrics/application/gateways/renderable-chord-sheet-write-model.interface";
import { IGeniusClient } from "../../core/synced-lyrics/application/ports/genius-client.interface";
import { ILrcLibClient } from "../../core/synced-lyrics/application/ports/lrclib-client.interface";
import { ISyncedLyricsBulkDispatcher } from "../../core/synced-lyrics/application/ports/synced-lyrics-bulk-dispatcher.interface";
import { DownloadSyncedLyricsForMusicLibraryUseCase } from "../../core/synced-lyrics/application/use-cases/download-synced-lyrics-for-music-library/download-synced-lyrics-for-music-library.use-case";
import { GetChordSheetForMusicLibraryUseCase } from "../../core/synced-lyrics/application/use-cases/get-chord-sheet-for-music-library/get-chord-sheet-for-music-library.use-case";
import { GetRenderableChordSheetForMusicLibraryUseCase } from "../../core/synced-lyrics/application/use-cases/get-renderable-chord-sheet-for-music-library/get-renderable-chord-sheet-for-music-library.use-case";
import { GetSyncedLyricsBulkJobUseCase } from "../../core/synced-lyrics/application/use-cases/get-synced-lyrics-bulk-job/get-synced-lyrics-bulk-job.use-case";
import { GetSyncedLyricsForMusicLibraryUseCase } from "../../core/synced-lyrics/application/use-cases/get-synced-lyrics-for-music-library/get-synced-lyrics-for-music-library.use-case";
import { MatchSyncedLyricsOnLrclibUseCase } from "../../core/synced-lyrics/application/use-cases/match-synced-lyrics-on-lrclib/match-synced-lyrics-on-lrclib.use-case";
import { MaterializeChordSheetsUseCase } from "../../core/synced-lyrics/application/use-cases/materialize-chord-sheets/materialize-chord-sheets.use-case";
import { MaterializeRenderableChordSheetsUseCase } from "../../core/synced-lyrics/application/use-cases/materialize-renderable-chord-sheets/materialize-renderable-chord-sheets.use-case";
import { ProcessSyncedLyricsBulkItemUseCase } from "../../core/synced-lyrics/application/use-cases/process-synced-lyrics-bulk-item/process-synced-lyrics-bulk-item.use-case";
import { RequestSyncedLyricsBulkSyncUseCase } from "../../core/synced-lyrics/application/use-cases/request-synced-lyrics-bulk-sync/request-synced-lyrics-bulk-sync.use-case";
import { SearchSyncedLyricsUseCase } from "../../core/synced-lyrics/application/use-cases/search-synced-lyrics/search-synced-lyrics.use-case";
import { SyncSyncedLyricsForMusicLibraryUseCase } from "../../core/synced-lyrics/application/use-cases/sync-synced-lyrics-for-music-library/sync-synced-lyrics-for-music-library.use-case";
import { UpsertSyncedLyricsForMusicLibraryUseCase } from "../../core/synced-lyrics/application/use-cases/upsert-synced-lyrics-for-music-library/upsert-synced-lyrics-for-music-library.use-case";
import {
  ISyncedLyricsBulkJobRepository,
  ISyncedLyricsRepository,
} from "../../core/synced-lyrics/domain";
import {
  SyncedLyricsBulkJobPrismaRepository,
  SyncedLyricsPrismaRepository,
} from "../../core/synced-lyrics/infra/db/prisma";
import { ChordSheetPrismaReadModel } from "../../core/synced-lyrics/infra/db/prisma/chord-sheet-prisma.read-model";
import { ChordSheetPrismaWriteModel } from "../../core/synced-lyrics/infra/db/prisma/chord-sheet-prisma.write-model";
import { RenderableChordSheetPrismaReadModel } from "../../core/synced-lyrics/infra/db/prisma/renderable-chord-sheet-prisma.read-model";
import { RenderableChordSheetPrismaWriteModel } from "../../core/synced-lyrics/infra/db/prisma/renderable-chord-sheet-prisma.write-model";
import {
  GeniusHttpClient,
  GeniusNoopClient,
} from "../../core/synced-lyrics/infra/http/genius-http.client";
import { LrcLibHttpClient } from "../../core/synced-lyrics/infra/http/lrclib-http.client";
import { ConfigSchemaType } from "../config-module/config.schema";
import { PrismaService } from "../database-module/prisma/prisma.service";
import {
  SyncedLyricsBulkInlineDispatcher,
  SyncedLyricsNoopDispatcher,
  SyncedLyricsRabbitmqDispatcher,
} from "./synced-lyrics.dispatcher";

export const REPOSITORIES = {
  SYNCED_LYRICS_REPOSITORY: {
    provide: "SyncedLyricsRepository",
    useExisting: SyncedLyricsPrismaRepository,
  },
  SYNCED_LYRICS_PRISMA_REPOSITORY: {
    provide: SyncedLyricsPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new SyncedLyricsPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
  CHORD_SHEET_READ_MODEL: {
    provide: "ChordSheetReadModel",
    useFactory: (prismaService: PrismaService) => {
      return new ChordSheetPrismaReadModel(prismaService);
    },
    inject: [PrismaService],
  },
  RENDERABLE_CHORD_SHEET_READ_MODEL: {
    provide: "RenderableChordSheetReadModel",
    useFactory: (prismaService: PrismaService) => {
      return new RenderableChordSheetPrismaReadModel(prismaService);
    },
    inject: [PrismaService],
  },
  CHORD_SHEET_WRITE_MODEL: {
    provide: "ChordSheetWriteModel",
    useFactory: (prismaService: PrismaService) => {
      return new ChordSheetPrismaWriteModel(prismaService);
    },
    inject: [PrismaService],
  },
  RENDERABLE_CHORD_SHEET_WRITE_MODEL: {
    provide: "RenderableChordSheetWriteModel",
    useFactory: (prismaService: PrismaService) => {
      return new RenderableChordSheetPrismaWriteModel(prismaService);
    },
    inject: [PrismaService],
  },
  SYNCED_LYRICS_BULK_JOB_REPOSITORY: {
    provide: "SyncedLyricsBulkJobRepository",
    useExisting: SyncedLyricsBulkJobPrismaRepository,
  },
  SYNCED_LYRICS_BULK_JOB_PRISMA_REPOSITORY: {
    provide: SyncedLyricsBulkJobPrismaRepository,
    useFactory: (prismaService: PrismaService) => {
      return new SyncedLyricsBulkJobPrismaRepository(prismaService);
    },
    inject: [PrismaService],
  },
};

export const INFRA_PROVIDERS = {
  LRCLIB_CLIENT: {
    provide: "LrcLibClient",
    useFactory: () => {
      return LrcLibHttpClient.create({
        baseURL: "https://lrclib.net",
        timeoutMs: 7000,
      });
    },
  },
  GENIUS_CLIENT: {
    provide: "GeniusClient",
    useFactory: (configService: ConfigSchemaType): IGeniusClient => {
      const token = configService.get<string>("GENIUS_ACCESS_TOKEN");
      if (!token || !token.trim()) {
        return new GeniusNoopClient();
      }
      return GeniusHttpClient.create({
        accessToken: token.trim(),
        timeoutMs: 9000,
      });
    },
    inject: [ConfigService],
  },
  SYNCED_LYRICS_BULK_DISPATCHER: {
    provide: "SyncedLyricsBulkDispatcher",
    useFactory: (
      processUseCase: ProcessSyncedLyricsBulkItemUseCase,
      moduleRef: ModuleRef,
      configService: ConfigSchemaType,
    ): ISyncedLyricsBulkDispatcher => {
      const transport =
        configService.get<string>("SYNCED_LYRICS_BULK_TRANSPORT") ?? "inline";
      if (transport === "rabbitmq") {
        const amqpConnection = moduleRef.get(AmqpConnection, { strict: false });
        if (!amqpConnection) {
          return new SyncedLyricsNoopDispatcher();
        }
        const routingKey =
          configService.get<string>(
            "RABBITMQ_ROUTING_KEY_SYNCED_LYRICS_BULK_REQUESTED",
          ) ?? "ai-musician.synced-lyrics-bulk.requested";
        return new SyncedLyricsRabbitmqDispatcher(amqpConnection, routingKey);
      }

      if (transport !== "inline") {
        return new SyncedLyricsNoopDispatcher();
      }

      const concurrency =
        configService.get<number>("SYNCED_LYRICS_BULK_CONCURRENCY") ?? 4;
      return new SyncedLyricsBulkInlineDispatcher(processUseCase, concurrency, {
        maxQueueSize:
          configService.get<number>("SYNCED_LYRICS_BULK_MAX_QUEUE_SIZE") ?? 500,
        enqueueRetryDelayMs:
          configService.get<number>(
            "SYNCED_LYRICS_BULK_BACKPRESSURE_ENQUEUE_DELAY_MS",
          ) ?? 250,
        tickDelayMs:
          configService.get<number>(
            "SYNCED_LYRICS_BULK_BACKPRESSURE_TICK_MS",
          ) ?? 250,
      });
    },
    inject: [ProcessSyncedLyricsBulkItemUseCase, ModuleRef, ConfigService],
  },
};

export const USE_CASES = {
  GET_SYNCED_LYRICS_FOR_MUSIC_LIBRARY_USE_CASE: {
    provide: GetSyncedLyricsForMusicLibraryUseCase,
    useFactory: (repo: ISyncedLyricsRepository) => {
      return new GetSyncedLyricsForMusicLibraryUseCase(repo);
    },
    inject: [REPOSITORIES.SYNCED_LYRICS_REPOSITORY.provide],
  },
  GET_CHORD_SHEET_FOR_MUSIC_LIBRARY_USE_CASE: {
    provide: GetChordSheetForMusicLibraryUseCase,
    useFactory: (readModel: IChordSheetReadModel) => {
      return new GetChordSheetForMusicLibraryUseCase(readModel);
    },
    inject: [REPOSITORIES.CHORD_SHEET_READ_MODEL.provide],
  },
  GET_RENDERABLE_CHORD_SHEET_FOR_MUSIC_LIBRARY_USE_CASE: {
    provide: GetRenderableChordSheetForMusicLibraryUseCase,
    useFactory: (readModel: IRenderableChordSheetReadModel) => {
      return new GetRenderableChordSheetForMusicLibraryUseCase(readModel);
    },
    inject: [REPOSITORIES.RENDERABLE_CHORD_SHEET_READ_MODEL.provide],
  },
  MATERIALIZE_CHORD_SHEETS_USE_CASE: {
    provide: MaterializeChordSheetsUseCase,
    useFactory: (
      getChordSheetUseCase: GetChordSheetForMusicLibraryUseCase,
      writeModel: IChordSheetWriteModel,
    ) => {
      return new MaterializeChordSheetsUseCase(
        getChordSheetUseCase,
        writeModel,
      );
    },
    inject: [
      GetChordSheetForMusicLibraryUseCase,
      REPOSITORIES.CHORD_SHEET_WRITE_MODEL.provide,
    ],
  },
  MATERIALIZE_RENDERABLE_CHORD_SHEETS_USE_CASE: {
    provide: MaterializeRenderableChordSheetsUseCase,
    useFactory: (
      getChordSheetUseCase: GetChordSheetForMusicLibraryUseCase,
      writeModel: IRenderableChordSheetWriteModel,
    ) => {
      return new MaterializeRenderableChordSheetsUseCase(
        getChordSheetUseCase,
        writeModel,
      );
    },
    inject: [
      GetChordSheetForMusicLibraryUseCase,
      REPOSITORIES.RENDERABLE_CHORD_SHEET_WRITE_MODEL.provide,
    ],
  },
  UPSERT_SYNCED_LYRICS_FOR_MUSIC_LIBRARY_USE_CASE: {
    provide: UpsertSyncedLyricsForMusicLibraryUseCase,
    useFactory: (repo: ISyncedLyricsRepository) => {
      return new UpsertSyncedLyricsForMusicLibraryUseCase(repo);
    },
    inject: [REPOSITORIES.SYNCED_LYRICS_REPOSITORY.provide],
  },
  SEARCH_SYNCED_LYRICS_USE_CASE: {
    provide: SearchSyncedLyricsUseCase,
    useFactory: (repo: ISyncedLyricsRepository) => {
      return new SearchSyncedLyricsUseCase(repo);
    },
    inject: [REPOSITORIES.SYNCED_LYRICS_REPOSITORY.provide],
  },
  DOWNLOAD_SYNCED_LYRICS_FOR_MUSIC_LIBRARY_USE_CASE: {
    provide: DownloadSyncedLyricsForMusicLibraryUseCase,
    useFactory: (repo: ISyncedLyricsRepository) => {
      return new DownloadSyncedLyricsForMusicLibraryUseCase(repo);
    },
    inject: [REPOSITORIES.SYNCED_LYRICS_REPOSITORY.provide],
  },
  SYNC_SYNCED_LYRICS_FOR_MUSIC_LIBRARY_USE_CASE: {
    provide: SyncSyncedLyricsForMusicLibraryUseCase,
    useFactory: (
      repo: ISyncedLyricsRepository,
      lrclib: ILrcLibClient,
      cache: Cache,
      genius: IGeniusClient,
    ) => {
      return new SyncSyncedLyricsForMusicLibraryUseCase(
        repo,
        lrclib,
        cache,
        genius,
      );
    },
    inject: [
      REPOSITORIES.SYNCED_LYRICS_REPOSITORY.provide,
      INFRA_PROVIDERS.LRCLIB_CLIENT.provide,
      CACHE_MANAGER,
      INFRA_PROVIDERS.GENIUS_CLIENT.provide,
    ],
  },
  MATCH_SYNCED_LYRICS_ON_LRCLIB_USE_CASE: {
    provide: MatchSyncedLyricsOnLrclibUseCase,
    useFactory: (lrclib: ILrcLibClient, cache: Cache) => {
      return new MatchSyncedLyricsOnLrclibUseCase(lrclib, cache);
    },
    inject: [INFRA_PROVIDERS.LRCLIB_CLIENT.provide, CACHE_MANAGER],
  },
  REQUEST_SYNCED_LYRICS_BULK_SYNC_USE_CASE: {
    provide: RequestSyncedLyricsBulkSyncUseCase,
    useFactory: (
      jobRepo: ISyncedLyricsBulkJobRepository,
      dispatcher: ISyncedLyricsBulkDispatcher,
    ) => {
      return new RequestSyncedLyricsBulkSyncUseCase(jobRepo, dispatcher);
    },
    inject: [
      REPOSITORIES.SYNCED_LYRICS_BULK_JOB_REPOSITORY.provide,
      INFRA_PROVIDERS.SYNCED_LYRICS_BULK_DISPATCHER.provide,
    ],
  },
  GET_SYNCED_LYRICS_BULK_JOB_USE_CASE: {
    provide: GetSyncedLyricsBulkJobUseCase,
    useFactory: (jobRepo: ISyncedLyricsBulkJobRepository) => {
      return new GetSyncedLyricsBulkJobUseCase(jobRepo);
    },
    inject: [REPOSITORIES.SYNCED_LYRICS_BULK_JOB_REPOSITORY.provide],
  },
  PROCESS_SYNCED_LYRICS_BULK_ITEM_USE_CASE: {
    provide: ProcessSyncedLyricsBulkItemUseCase,
    useFactory: (
      jobRepo: ISyncedLyricsBulkJobRepository,
      syncUseCase: SyncSyncedLyricsForMusicLibraryUseCase,
    ) => {
      return new ProcessSyncedLyricsBulkItemUseCase(jobRepo, syncUseCase);
    },
    inject: [
      REPOSITORIES.SYNCED_LYRICS_BULK_JOB_REPOSITORY.provide,
      SyncSyncedLyricsForMusicLibraryUseCase,
    ],
  },
};

export const SYNCED_LYRICS_PROVIDERS = {
  REPOSITORIES,
  INFRA_PROVIDERS,
  USE_CASES,
};
