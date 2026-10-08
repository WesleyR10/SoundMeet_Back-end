import { PlanLimitExceededError } from "../../../../../plans/domain/errors/plan-limit-exceeded.error";
import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { EstablishmentPlanTier } from "../../../../../plans/domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../../plans/domain/subscription.aggregate";
import { SubscriptionInMemoryRepository } from "../../../../../plans/infra/db/in-memory/subscription-in-memory.repository";
import { EstablishmentId } from "../../../../domain/establishment.aggregate";
import {
  EstablishmentAnalytics,
  EstablishmentAnalyticsId,
} from "../../../../domain/establishment-analytics.read-model";
import {
  EstablishmentAnalyticsSearchParams,
  EstablishmentAnalyticsSearchResult,
  IEstablishmentAnalyticsRepository,
} from "../../../../domain/establishment-analytics.repository";
import { EstablishmentAnalyticsFakeBuilder } from "../../../../domain/establishment-analytics-fake.builder";
import { ListEstablishmentAnalyticsUseCase } from "../list-establishment-analytics.use-case";

const ESTABLISHMENT_ID = "11111111-1111-4111-8111-111111111111";

class EstablishmentAnalyticsRepositoryStub implements IEstablishmentAnalyticsRepository {
  sortableFields: string[] = [];
  receivedSearchParams: EstablishmentAnalyticsSearchParams | null = null;
  searchCallCount = 0;

  constructor(
    private readonly searchResult: EstablishmentAnalyticsSearchResult,
  ) {}

  async search(
    props: EstablishmentAnalyticsSearchParams,
  ): Promise<EstablishmentAnalyticsSearchResult> {
    this.receivedSearchParams = props;
    this.searchCallCount++;
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

async function makePlanCheckService(
  tier?: EstablishmentPlanTier,
  cancelled = false,
) {
  const subRepo = new SubscriptionInMemoryRepository();
  if (tier) {
    await subRepo.insert(
      new Subscription({
        establishment_id: ESTABLISHMENT_ID,
        plan_tier: tier,
        persona: "establishment",
        status: cancelled
          ? SubscriptionStatus.CANCELLED
          : SubscriptionStatus.ACTIVE,
      }),
    );
  }
  return new PlanCheckService(subRepo);
}

function emptyResult() {
  return new EstablishmentAnalyticsSearchResult({
    items: [],
    total: 0,
    current_page: 1,
    per_page: 15,
  });
}

describe("ListEstablishmentAnalyticsUseCase Unit Tests", () => {
  it("should map SearchResult to output", async () => {
    const useCase = new ListEstablishmentAnalyticsUseCase(
      new EstablishmentAnalyticsRepositoryStub(emptyResult()),
      await makePlanCheckService(EstablishmentPlanTier.PRO),
    );

    const output = useCase["toOutput"](emptyResult());

    expect(output).toStrictEqual({
      items: [],
      total: 0,
      current_page: 1,
      per_page: 15,
      last_page: 0,
    });
  });

  it("should return analytics items", async () => {
    const establishmentId = new EstablishmentId(ESTABLISHMENT_ID);
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
    const useCase = new ListEstablishmentAnalyticsUseCase(
      repository,
      await makePlanCheckService(EstablishmentPlanTier.GROWTH),
    );

    const output = await useCase.execute({
      establishment_id: ESTABLISHMENT_ID,
      page: 1,
      per_page: 2,
      sort: "date",
      sort_dir: "desc",
      filter: {
        date_gte: new Date("2026-01-01T00:00:00.000Z"),
        date_lte: new Date("2026-01-31T00:00:00.000Z"),
      },
    });

    expect(repository.receivedSearchParams).toBeInstanceOf(
      EstablishmentAnalyticsSearchParams,
    );
    expect(repository.receivedSearchParams?.page).toBe(1);
    expect(repository.receivedSearchParams?.per_page).toBe(2);
    expect(repository.receivedSearchParams?.sort).toBe("date");
    expect(repository.receivedSearchParams?.sort_dir).toBe("desc");
    expect(repository.receivedSearchParams?.filter).toMatchObject({
      establishment_id: ESTABLISHMENT_ID,
      date_gte: new Date("2026-01-01T00:00:00.000Z"),
      date_lte: new Date("2026-01-31T00:00:00.000Z"),
    });

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
    const useCase = new ListEstablishmentAnalyticsUseCase(
      repository,
      await makePlanCheckService(EstablishmentPlanTier.PRO),
    );

    await useCase.execute({
      establishment_id: ESTABLISHMENT_ID,
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
    // ⚠️ Mudança de comportamento deliberada (9.7a). Este teste esperava
    // `filter` NULO quando o chamador mandava lixo — o que significava buscar
    // SEM escopo, ou seja, devolver as métricas de todos os estabelecimentos.
    // O escopo agora é injetado pelo use-case e sobrevive a qualquer entrada
    // inválida: lixo no filtro degrada os campos opcionais, nunca o escopo.
    expect(repository.receivedSearchParams?.filter).toStrictEqual({
      establishment_id: ESTABLISHMENT_ID,
    });
  });

  it("não deixa o filtro sobrescrever o escopo do estabelecimento", async () => {
    const repository = new EstablishmentAnalyticsRepositoryStub(emptyResult());
    const useCase = new ListEstablishmentAnalyticsUseCase(
      repository,
      await makePlanCheckService(EstablishmentPlanTier.PRO),
    );

    await useCase.execute({
      establishment_id: ESTABLISHMENT_ID,
      // Um cliente tentando ler o analytics do concorrente pelo filtro.
      filter: {
        establishment_id: "22222222-2222-4222-8222-222222222222",
      } as any,
    });

    expect(repository.receivedSearchParams?.filter).toMatchObject({
      establishment_id: ESTABLISHMENT_ID,
    });
  });
});

describe("ListEstablishmentAnalyticsUseCase — gate 9.7a (advanced_analytics)", () => {
  it("(a) FREE: lança PlanLimitExceededError", async () => {
    const repository = new EstablishmentAnalyticsRepositoryStub(emptyResult());
    const useCase = new ListEstablishmentAnalyticsUseCase(
      repository,
      await makePlanCheckService(),
    );

    await expect(
      useCase.execute({ establishment_id: ESTABLISHMENT_ID }),
    ).rejects.toThrow(PlanLimitExceededError);
  });

  it("(a) FREE: nem chega a consultar o repositório", async () => {
    const repository = new EstablishmentAnalyticsRepositoryStub(emptyResult());
    const useCase = new ListEstablishmentAnalyticsUseCase(
      repository,
      await makePlanCheckService(),
    );

    await expect(
      useCase.execute({ establishment_id: ESTABLISHMENT_ID }),
    ).rejects.toThrow(PlanLimitExceededError);

    expect(repository.searchCallCount).toBe(0);
  });

  it("(b) GROWTH: acesso liberado", async () => {
    const repository = new EstablishmentAnalyticsRepositoryStub(emptyResult());
    const useCase = new ListEstablishmentAnalyticsUseCase(
      repository,
      await makePlanCheckService(EstablishmentPlanTier.GROWTH),
    );

    await expect(
      useCase.execute({ establishment_id: ESTABLISHMENT_ID }),
    ).resolves.toBeDefined();
  });

  it("(b) PRO: acesso liberado", async () => {
    const repository = new EstablishmentAnalyticsRepositoryStub(emptyResult());
    const useCase = new ListEstablishmentAnalyticsUseCase(
      repository,
      await makePlanCheckService(EstablishmentPlanTier.PRO),
    );

    await expect(
      useCase.execute({ establishment_id: ESTABLISHMENT_ID }),
    ).resolves.toBeDefined();
  });

  it("(c) assinatura cancelada volta ao FREE e bloqueia", async () => {
    const repository = new EstablishmentAnalyticsRepositoryStub(emptyResult());
    const useCase = new ListEstablishmentAnalyticsUseCase(
      repository,
      await makePlanCheckService(EstablishmentPlanTier.PRO, true),
    );

    await expect(
      useCase.execute({ establishment_id: ESTABLISHMENT_ID }),
    ).rejects.toThrow(PlanLimitExceededError);
  });
});
