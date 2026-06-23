import { EstablishmentId } from "../../../../domain/establishment.aggregate";
import {
  EstablishmentAnalytics,
  EstablishmentAnalyticsId,
} from "../../../../domain/establishment-analytics.read-model";
import {
  EstablishmentAnalyticsFilter,
  EstablishmentAnalyticsSearchParams,
  EstablishmentAnalyticsSearchResult,
  IEstablishmentAnalyticsRepository,
} from "../../../../domain/establishment-analytics.repository";
import { EstablishmentAnalyticsFakeBuilder } from "../../../../domain/establishment-analytics-fake.builder";
import { ListEstablishmentAnalyticsUseCase } from "../list-establishment-analytics.use-case";

class EstablishmentAnalyticsRepositoryStub implements IEstablishmentAnalyticsRepository {
  sortableFields: string[] = [];
  receivedSearchParams: EstablishmentAnalyticsSearchParams | null = null;

  constructor(
    private readonly searchResult: EstablishmentAnalyticsSearchResult,
  ) {}

  async search(
    props: EstablishmentAnalyticsSearchParams,
  ): Promise<EstablishmentAnalyticsSearchResult> {
    this.receivedSearchParams = props;
    return this.searchResult;
  }

  async upsertDaily(): Promise<EstablishmentAnalytics> {
    throw new Error("Not implemented");
  }

  async findByEstablishmentAndDate(): Promise<EstablishmentAnalytics | null> {
    throw new Error("Not implemented");
  }

  async calculateDailyMetrics(): Promise<any> {
    throw new Error("Not implemented");
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
}

describe("ListEstablishmentAnalyticsUseCase Unit Tests", () => {
  it("should map SearchResult to output", () => {
    const useCase = new ListEstablishmentAnalyticsUseCase(
      new EstablishmentAnalyticsRepositoryStub(
        new EstablishmentAnalyticsSearchResult({
          items: [],
          total: 0,
          current_page: 1,
          per_page: 15,
        }),
      ),
    );

    const output = useCase["toOutput"](
      new EstablishmentAnalyticsSearchResult({
        items: [],
        total: 0,
        current_page: 1,
        per_page: 15,
      }),
    );

    expect(output).toStrictEqual({
      items: [],
      total: 0,
      current_page: 1,
      per_page: 15,
      last_page: 0,
    });
  });

  it("should return analytics items", async () => {
    const establishmentId = new EstablishmentId(
      "11111111-1111-4111-8111-111111111111",
    );
    const analytics = EstablishmentAnalyticsFakeBuilder.theAnalytics(2)
      .withEstablishmentId(establishmentId)
      .withDate((i) => new Date(Date.UTC(2026, 0, i + 1)))
      .withEventsHosted(3)
      .withTotalAttendees(50)
      .withMusiciansHired(2)
      .withTotalSpent(123.45)
      .withAvgRating(4.2)
      .build() as EstablishmentAnalytics[];

    const searchResult = new EstablishmentAnalyticsSearchResult({
      items: analytics,
      total: 2,
      current_page: 1,
      per_page: 2,
    });
    const repository = new EstablishmentAnalyticsRepositoryStub(searchResult);
    const useCase = new ListEstablishmentAnalyticsUseCase(repository);

    const filter: EstablishmentAnalyticsFilter = {
      establishment_id: establishmentId.id,
      date_gte: new Date("2026-01-01T00:00:00.000Z"),
      date_lte: new Date("2026-01-31T00:00:00.000Z"),
    };
    const output = await useCase.execute({
      page: 1,
      per_page: 2,
      sort: "date",
      sort_dir: "desc",
      filter,
    });

    expect(repository.receivedSearchParams).toBeInstanceOf(
      EstablishmentAnalyticsSearchParams,
    );
    expect(repository.receivedSearchParams?.page).toBe(1);
    expect(repository.receivedSearchParams?.per_page).toBe(2);
    expect(repository.receivedSearchParams?.sort).toBe("date");
    expect(repository.receivedSearchParams?.sort_dir).toBe("desc");
    expect(repository.receivedSearchParams?.filter).toMatchObject(filter);

    expect(output).toStrictEqual({
      items: analytics.map((a) => ({
        id: a.analytics_id.id,
        establishment_id: a.establishment_id.id,
        date: a.date,
        events_hosted: a.events_hosted,
        total_attendees: a.total_attendees,
        musicians_hired: a.musicians_hired,
        total_spent: a.total_spent,
        avg_rating: a.avg_rating,
        created_at: a.created_at,
      })),
      total: 2,
      current_page: 1,
      per_page: 2,
      last_page: 1,
    });
  });

  it("should normalize invalid input in SearchParams", async () => {
    const analytics =
      EstablishmentAnalyticsFakeBuilder.anAnalytics().build() as EstablishmentAnalytics;
    const repository = new EstablishmentAnalyticsRepositoryStub(
      new EstablishmentAnalyticsSearchResult({
        items: [analytics],
        total: 1,
        current_page: 1,
        per_page: 15,
      }),
    );
    const useCase = new ListEstablishmentAnalyticsUseCase(repository);

    await useCase.execute({
      page: 0,
      per_page: 0,
      sort: "",
      sort_dir: "invalid" as any,
      filter: "" as any,
    });

    expect(repository.receivedSearchParams?.page).toBe(1);
    expect(repository.receivedSearchParams?.per_page).toBe(15);
    expect(repository.receivedSearchParams?.sort).toBeNull();
    expect(repository.receivedSearchParams?.sort_dir).toBeNull();
    expect(repository.receivedSearchParams?.filter).toBeNull();
  });
});
