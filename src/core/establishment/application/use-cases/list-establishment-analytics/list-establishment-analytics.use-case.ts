import {
  PaginationOutput,
  PaginationOutputMapper,
} from "../../../../shared/application/pagination-output";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { SortDirection } from "../../../../shared/domain/repository/search-params";
import { EstablishmentAnalytics } from "../../../domain/establishment-analytics.read-model";
import {
  EstablishmentAnalyticsFilter,
  EstablishmentAnalyticsSearchParams,
  EstablishmentAnalyticsSearchResult,
  IEstablishmentAnalyticsRepository,
} from "../../../domain/establishment-analytics.repository";

export type EstablishmentAnalyticsOutput = {
  id: string;
  establishment_id: string;
  date: Date;
  events_hosted: number;
  total_attendees: number;
  musicians_hired: number;
  total_spent: number;
  avg_rating: number;
  created_at: Date;
};

export class EstablishmentAnalyticsOutputMapper {
  static toOutput(
    entity: EstablishmentAnalytics,
  ): EstablishmentAnalyticsOutput {
    return {
      id: entity.analytics_id.id,
      establishment_id: entity.establishment_id.id,
      date: entity.date,
      events_hosted: entity.events_hosted,
      total_attendees: entity.total_attendees,
      musicians_hired: entity.musicians_hired,
      total_spent: entity.total_spent,
      avg_rating: entity.avg_rating,
      created_at: entity.created_at,
    };
  }
}

export class ListEstablishmentAnalyticsUseCase implements IUseCase<
  ListEstablishmentAnalyticsInput,
  ListEstablishmentAnalyticsOutput
> {
  constructor(
    private readonly analyticsRepo: IEstablishmentAnalyticsRepository,
  ) {}

  async execute(
    input: ListEstablishmentAnalyticsInput,
  ): Promise<ListEstablishmentAnalyticsOutput> {
    const params = EstablishmentAnalyticsSearchParams.create(input);
    const searchResult = await this.analyticsRepo.search(params);
    return this.toOutput(searchResult);
  }

  private toOutput(
    searchResult: EstablishmentAnalyticsSearchResult,
  ): ListEstablishmentAnalyticsOutput {
    const items = searchResult.items.map((i) =>
      EstablishmentAnalyticsOutputMapper.toOutput(i),
    );
    return PaginationOutputMapper.toOutput(items, searchResult);
  }
}

export type ListEstablishmentAnalyticsInput = {
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: EstablishmentAnalyticsFilter | null;
};

export type ListEstablishmentAnalyticsOutput =
  PaginationOutput<EstablishmentAnalyticsOutput>;
