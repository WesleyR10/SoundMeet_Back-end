import { Email } from "../../../../../shared/domain";
import {
  Establishment,
  EstablishmentId,
} from "../../../../domain/establishment.aggregate";
import {
  EstablishmentSearchParams,
  EstablishmentSearchResult,
  IEstablishmentRepository,
} from "../../../../domain/establishment.repository";
import {
  EstablishmentAnalytics,
  EstablishmentAnalyticsId,
} from "../../../../domain/establishment-analytics.read-model";
import {
  EstablishmentAnalyticsDailyMetrics,
  EstablishmentAnalyticsSearchParams,
  EstablishmentAnalyticsSearchResult,
  IEstablishmentAnalyticsRepository,
} from "../../../../domain/establishment-analytics.repository";
import { RecalculateEstablishmentAnalyticsUseCase } from "../recalculate-establishment-analytics.use-case";

class EstablishmentRepositoryStub implements IEstablishmentRepository {
  sortableFields: string[] = [];
  receivedSearchParams: EstablishmentSearchParams[] = [];

  constructor(private readonly items: Establishment[]) {}

  async insert(): Promise<void> {
    throw new Error("Not implemented");
  }

  async bulkInsert(): Promise<void> {
    throw new Error("Not implemented");
  }

  async update(): Promise<void> {
    throw new Error("Not implemented");
  }

  async delete(): Promise<void> {
    throw new Error("Not implemented");
  }

  async deleteProfile(): Promise<void> {
    throw new Error("Not implemented");
  }

  async findById(): Promise<Establishment | null> {
    throw new Error("Not implemented");
  }

  async findAll(): Promise<Establishment[]> {
    return this.items;
  }

  async findByIds(): Promise<Establishment[]> {
    throw new Error("Not implemented");
  }

  async existsById(): Promise<{
    exists: EstablishmentId[];
    not_exists: EstablishmentId[];
  }> {
    throw new Error("Not implemented");
  }

  getEntity(): new (...args: any[]) => Establishment {
    return Establishment;
  }

  async search(
    props: EstablishmentSearchParams,
  ): Promise<EstablishmentSearchResult> {
    this.receivedSearchParams.push(props);
    const start = (props.page - 1) * props.per_page;
    const end = start + props.per_page;
    return new EstablishmentSearchResult({
      items: this.items.slice(start, end),
      total: this.items.length,
      current_page: props.page,
      per_page: props.per_page,
    });
  }
}

class EstablishmentAnalyticsRepositoryStub implements IEstablishmentAnalyticsRepository {
  sortableFields: string[] = [];

  metricsByEstablishmentId: Map<string, EstablishmentAnalyticsDailyMetrics> =
    new Map();

  upserted: EstablishmentAnalytics[] = [];

  async upsertDaily(
    entity: EstablishmentAnalytics,
  ): Promise<EstablishmentAnalytics> {
    this.upserted.push(entity);
    return entity;
  }

  async findByEstablishmentAndDate(): Promise<EstablishmentAnalytics | null> {
    throw new Error("Not implemented");
  }

  async calculateDailyMetrics(
    establishment_id: string,
    date: Date,
  ): Promise<EstablishmentAnalyticsDailyMetrics> {
    const found = this.metricsByEstablishmentId.get(establishment_id);
    if (!found) {
      throw new Error(`Missing metrics for ${establishment_id}`);
    }
    return {
      ...found,
      date,
    };
  }

  async insert(): Promise<void> {
    throw new Error("Not implemented");
  }

  async bulkInsert(): Promise<void> {
    throw new Error("Not implemented");
  }

  async update(): Promise<void> {
    throw new Error("Not implemented");
  }

  async delete(): Promise<void> {
    throw new Error("Not implemented");
  }

  async findById(): Promise<EstablishmentAnalytics | null> {
    throw new Error("Not implemented");
  }

  async findAll(): Promise<EstablishmentAnalytics[]> {
    throw new Error("Not implemented");
  }

  async findByIds(): Promise<EstablishmentAnalytics[]> {
    throw new Error("Not implemented");
  }

  async existsById(): Promise<{
    exists: EstablishmentAnalyticsId[];
    not_exists: EstablishmentAnalyticsId[];
  }> {
    throw new Error("Not implemented");
  }

  getEntity(): new (...args: any[]) => EstablishmentAnalytics {
    return EstablishmentAnalytics;
  }

  async search(
    props: EstablishmentAnalyticsSearchParams,
  ): Promise<EstablishmentAnalyticsSearchResult> {
    throw new Error("Not implemented");
  }
}

describe("RecalculateEstablishmentAnalyticsUseCase Unit Tests", () => {
  it("should recalculate analytics for all establishments", async () => {
    const establishments = [
      new Establishment({
        name: "A",
        email: new Email("a@a.com"),
        establishment_type: "bar",
      }),
      new Establishment({
        name: "B",
        email: new Email("b@b.com"),
        establishment_type: "club",
      }),
    ];

    const establishmentRepo = new EstablishmentRepositoryStub(establishments);
    const analyticsRepo = new EstablishmentAnalyticsRepositoryStub();

    for (const establishment of establishments) {
      analyticsRepo.metricsByEstablishmentId.set(
        establishment.establishment_id.id,
        {
          date: new Date(),
          events_hosted: 1,
          total_attendees: 10,
          musicians_hired: 2,
          total_spent: 100,
          avg_rating: 4.5,
        },
      );
    }

    const useCase = new RecalculateEstablishmentAnalyticsUseCase(
      establishmentRepo,
      analyticsRepo,
    );

    const date = new Date("2026-01-14T12:34:56.000Z");
    const output = await useCase.execute({ date, concurrency: 1 });

    expect(output).toEqual({
      date: new Date(Date.UTC(2026, 0, 14)),
      processed: 2,
      failed: 0,
      failures: [],
    });
    expect(analyticsRepo.upserted).toHaveLength(2);
  });

  it("should paginate establishments when batch_size is small", async () => {
    const establishments = [
      new Establishment({
        name: "A",
        email: new Email("a@a.com"),
        establishment_type: "bar",
      }),
      new Establishment({
        name: "B",
        email: new Email("b@b.com"),
        establishment_type: "club",
      }),
    ];

    const establishmentRepo = new EstablishmentRepositoryStub(establishments);
    const analyticsRepo = new EstablishmentAnalyticsRepositoryStub();

    for (const establishment of establishments) {
      analyticsRepo.metricsByEstablishmentId.set(
        establishment.establishment_id.id,
        {
          date: new Date(),
          events_hosted: 1,
          total_attendees: 10,
          musicians_hired: 2,
          total_spent: 100,
          avg_rating: 4.5,
        },
      );
    }

    const useCase = new RecalculateEstablishmentAnalyticsUseCase(
      establishmentRepo,
      analyticsRepo,
    );

    const date = new Date("2026-01-14T12:34:56.000Z");
    const output = await useCase.execute({
      date,
      concurrency: 1,
      batch_size: 1,
    });

    expect(establishmentRepo.receivedSearchParams.map((p) => p.page)).toEqual([
      1, 2,
    ]);
    expect(output).toEqual({
      date: new Date(Date.UTC(2026, 0, 14)),
      processed: 2,
      failed: 0,
      failures: [],
    });
    expect(analyticsRepo.upserted).toHaveLength(2);
  });

  it("should use default date and default concurrency", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-15T10:00:00.000Z"));

    const establishments = [
      new Establishment({
        name: "A",
        email: new Email("a@a.com"),
        establishment_type: "bar",
      }),
    ];

    const establishmentRepo = new EstablishmentRepositoryStub(establishments);
    const analyticsRepo = new EstablishmentAnalyticsRepositoryStub();
    analyticsRepo.metricsByEstablishmentId.set(
      establishments[0].establishment_id.id,
      {
        date: new Date(),
        events_hosted: 1,
        total_attendees: 10,
        musicians_hired: 2,
        total_spent: 100,
        avg_rating: 4.5,
      },
    );

    const useCase = new RecalculateEstablishmentAnalyticsUseCase(
      establishmentRepo,
      analyticsRepo,
    );

    const output = await useCase.execute({});

    expect(output).toEqual({
      date: new Date(Date.UTC(2026, 0, 14)),
      processed: 1,
      failed: 0,
      failures: [],
    });

    jest.useRealTimers();
  });

  it("should normalize string errors", async () => {
    const establishment = new Establishment({
      name: "A",
      email: new Email("a@a.com"),
      establishment_type: "bar",
    });

    const establishmentRepo = new EstablishmentRepositoryStub([establishment]);
    const analyticsRepo = new EstablishmentAnalyticsRepositoryStub();
    analyticsRepo.calculateDailyMetrics = async () => {
      throw "boom";
    };

    const useCase = new RecalculateEstablishmentAnalyticsUseCase(
      establishmentRepo,
      analyticsRepo,
    );

    const output = await useCase.execute({
      date: new Date("2026-01-14T12:34:56.000Z"),
      concurrency: 0,
    });

    expect(output.processed).toBe(0);
    expect(output.failed).toBe(1);
    expect(output.failures).toEqual([
      { establishment_id: establishment.establishment_id.id, error: "boom" },
    ]);
  });

  it("should normalize unknown errors", async () => {
    const establishment = new Establishment({
      name: "A",
      email: new Email("a@a.com"),
      establishment_type: "bar",
    });

    const establishmentRepo = new EstablishmentRepositoryStub([establishment]);
    const analyticsRepo = new EstablishmentAnalyticsRepositoryStub();
    analyticsRepo.calculateDailyMetrics = async () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      throw circular;
    };

    const useCase = new RecalculateEstablishmentAnalyticsUseCase(
      establishmentRepo,
      analyticsRepo,
    );

    const output = await useCase.execute({
      date: new Date("2026-01-14T12:34:56.000Z"),
      concurrency: 1,
    });

    expect(output.processed).toBe(0);
    expect(output.failed).toBe(1);
    expect(output.failures).toEqual([
      {
        establishment_id: establishment.establishment_id.id,
        error: "Unknown error",
      },
    ]);
  });

  it("should include validation details when analytics entity is invalid", async () => {
    const establishment = new Establishment({
      name: "A",
      email: new Email("a@a.com"),
      establishment_type: "bar",
    });

    const establishmentRepo = new EstablishmentRepositoryStub([establishment]);
    const analyticsRepo = new EstablishmentAnalyticsRepositoryStub();
    analyticsRepo.metricsByEstablishmentId.set(
      establishment.establishment_id.id,
      {
        date: new Date(),
        events_hosted: 1,
        total_attendees: 10,
        musicians_hired: 2,
        total_spent: 100,
        avg_rating: 6,
      },
    );

    const useCase = new RecalculateEstablishmentAnalyticsUseCase(
      establishmentRepo,
      analyticsRepo,
    );

    const output = await useCase.execute({
      date: new Date("2026-01-14T12:34:56.000Z"),
      concurrency: 1,
    });

    expect(output.processed).toBe(0);
    expect(output.failed).toBe(1);
    expect(output.failures?.[0].error).toEqual(
      expect.stringContaining("EntityValidationError"),
    );
    expect(output.failures?.[0].error).toEqual(
      expect.stringContaining("avg_rating"),
    );
  });

  it("should handle empty establishment list", async () => {
    const establishmentRepo = new EstablishmentRepositoryStub([]);
    const analyticsRepo = new EstablishmentAnalyticsRepositoryStub();

    const useCase = new RecalculateEstablishmentAnalyticsUseCase(
      establishmentRepo,
      analyticsRepo,
    );

    const output = await useCase.execute({
      date: new Date("2026-01-14T12:34:56.000Z"),
    });

    expect(output).toEqual({
      date: new Date(Date.UTC(2026, 0, 14)),
      processed: 0,
      failed: 0,
      failures: [],
    });
  });

  it("should capture failures and keep processing others", async () => {
    const establishmentOk = new Establishment({
      name: "Ok",
      email: new Email("ok@a.com"),
      establishment_type: "bar",
    });
    const establishmentFail = new Establishment({
      name: "Fail",
      email: new Email("fail@a.com"),
      establishment_type: "bar",
    });

    const establishmentRepo = new EstablishmentRepositoryStub([
      establishmentOk,
      establishmentFail,
    ]);
    const analyticsRepo = new EstablishmentAnalyticsRepositoryStub();

    analyticsRepo.metricsByEstablishmentId.set(
      establishmentOk.establishment_id.id,
      {
        date: new Date(),
        events_hosted: 1,
        total_attendees: 10,
        musicians_hired: 2,
        total_spent: 100,
        avg_rating: 4,
      },
    );

    const useCase = new RecalculateEstablishmentAnalyticsUseCase(
      establishmentRepo,
      analyticsRepo,
    );

    const date = new Date("2026-01-14T12:34:56.000Z");
    const output = await useCase.execute({ date, concurrency: 2 });

    expect(output.processed).toBe(1);
    expect(output.failed).toBe(1);
    expect(output.failures).toEqual([
      {
        establishment_id: establishmentFail.establishment_id.id,
        error: expect.stringContaining("Missing metrics"),
      },
    ]);
    expect(analyticsRepo.upserted).toHaveLength(1);
  });
});
