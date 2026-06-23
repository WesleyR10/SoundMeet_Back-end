import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Establishment } from "../../../domain/establishment.aggregate";
import {
  EstablishmentSearchParams,
  IEstablishmentRepository,
} from "../../../domain/establishment.repository";
import { EstablishmentAnalytics } from "../../../domain/establishment-analytics.read-model";
import { IEstablishmentAnalyticsRepository } from "../../../domain/establishment-analytics.repository";

const toUtcDateOnly = (date: Date): Date => {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};

export class RecalculateEstablishmentAnalyticsUseCase implements IUseCase<
  RecalculateEstablishmentAnalyticsInput,
  RecalculateEstablishmentAnalyticsOutput
> {
  constructor(
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly analyticsRepo: IEstablishmentAnalyticsRepository,
  ) {}

  async execute(
    input: RecalculateEstablishmentAnalyticsInput,
  ): Promise<RecalculateEstablishmentAnalyticsOutput> {
    const now = new Date();
    const requested =
      input.date ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const day = toUtcDateOnly(requested);

    const batchSize =
      typeof input.batch_size === "number" && input.batch_size > 0
        ? Math.floor(input.batch_size)
        : 100;

    let processed = 0;
    let failed = 0;
    const failures: Array<{ establishment_id: string; error: string }> = [];

    let page = 1;
    while (true) {
      const searchResult = await this.establishmentRepo.search(
        EstablishmentSearchParams.create({
          page,
          per_page: batchSize,
        }),
      );

      if (searchResult.items.length === 0) {
        break;
      }

      const results = await this.recalculateAll(
        searchResult.items,
        day,
        input.concurrency,
      );

      processed += results.processed;
      failed += results.failed;
      failures.push(...results.failures);

      if (page >= searchResult.last_page) {
        break;
      }
      page += 1;
    }

    return {
      date: day,
      processed,
      failed,
      failures,
    };
  }

  private async recalculateAll(
    establishments: Establishment[],
    date: Date,
    concurrency?: number,
  ): Promise<{
    processed: number;
    failed: number;
    failures: Array<{ establishment_id: string; error: string }>;
  }> {
    const maxConcurrency =
      typeof concurrency === "number" && concurrency > 0
        ? Math.floor(concurrency)
        : 5;

    const results = await mapWithConcurrency(
      establishments,
      maxConcurrency,
      async (establishment) => {
        const establishment_id = establishment.establishment_id.id;
        try {
          const metrics = await this.analyticsRepo.calculateDailyMetrics(
            establishment_id,
            date,
          );

          const entity = EstablishmentAnalytics.create({
            establishment_id,
            date: metrics.date,
            events_hosted: metrics.events_hosted,
            total_attendees: metrics.total_attendees,
            musicians_hired: metrics.musicians_hired,
            total_spent: metrics.total_spent,
            avg_rating: metrics.avg_rating,
          });

          if (entity.notification.hasErrors()) {
            throw new EntityValidationError(entity.notification.toJSON());
          }

          await this.analyticsRepo.upsertDaily(entity);
          return { ok: true as const };
        } catch (error) {
          return {
            ok: false as const,
            establishment_id,
            error: normalizeError(error),
          };
        }
      },
    );

    const failures = results
      .filter((r) => !r.ok)
      .map((r) => ({
        establishment_id: r.establishment_id,
        error: r.error,
      }));

    return {
      processed: results.filter((r) => r.ok).length,
      failed: failures.length,
      failures,
    };
  }
}

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({
    length: Math.min(concurrency, items.length),
  }).map(async () => {
    while (true) {
      const index = currentIndex;
      if (index >= items.length) {
        return;
      }
      currentIndex += 1;
      results[index] = await mapper(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
};

const normalizeError = (error: unknown): string => {
  if (error instanceof EntityValidationError) {
    return `${error.name}: ${JSON.stringify(error.error)}`;
  }
  if (error instanceof Error) {
    return error.message ? `${error.name}: ${error.message}` : error.name;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

export type RecalculateEstablishmentAnalyticsInput = {
  date?: Date;
  concurrency?: number;
  batch_size?: number;
};

export type RecalculateEstablishmentAnalyticsOutput = {
  date: Date;
  processed: number;
  failed: number;
  failures?: Array<{ establishment_id: string; error: string }>;
};
