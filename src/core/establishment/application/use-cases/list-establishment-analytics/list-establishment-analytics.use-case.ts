import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
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
    private readonly planCheckService: PlanCheckService,
  ) {}

  async execute(
    input: ListEstablishmentAnalyticsInput,
  ): Promise<ListEstablishmentAnalyticsOutput> {
    // Gate real, decidido em 9.7a (16/ago/2026). `advanced_analytics` existia
    // no plan-features.config desde jun/2026 e NUNCA era lido — o FREE recebia
    // o mesmo analytics do Growth/PRO.
    await this.planCheckService.assertEstablishmentFeature(
      input.establishment_id,
      "advanced_analytics",
    );

    const params = EstablishmentAnalyticsSearchParams.create({
      ...input,
      // O escopo vem do parâmetro dedicado e SOBRESCREVE o filtro, nunca o
      // contrário. Antes, `establishment_id` era só mais um campo opcional do
      // filter: um chamador que o omitisse recebia as métricas de todos os
      // estabelecimentos, com 200 e sem erro nenhum. O controller sempre o
      // fixava, então nunca vazou por HTTP — mas o buraco estava no use-case,
      // e agora o gate acima também depende dele para resolver o plano.
      // Mesmo precedente do 9.6c (`musician_id` do path vence a query).
      filter: { ...input.filter, establishment_id: input.establishment_id },
    });
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
  /**
   * Obrigatório: é o escopo da consulta E o sujeito do gate de plano.
   * Não vive dentro de `filter` porque lá seria opcional — e opcional aqui
   * significa "devolve o analytics de todo mundo".
   */
  establishment_id: string;
  page?: number;
  per_page?: number;
  sort?: string | null;
  sort_dir?: SortDirection | null;
  filter?: Omit<EstablishmentAnalyticsFilter, "establishment_id"> | null;
};

export type ListEstablishmentAnalyticsOutput =
  PaginationOutput<EstablishmentAnalyticsOutput>;
