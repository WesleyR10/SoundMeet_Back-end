import {
  Establishment,
  EstablishmentId,
  IEstablishmentRepository,
} from "@core/establishment/domain";
import {
  EventOutput,
  EventOutputMapper,
} from "@core/events/application/use-cases/common/event-output";
import {
  EventFilter,
  EventSearchParams,
  IEventRepository,
} from "@core/events/domain";
import {
  BandFilter,
  BandSearchParams,
  IBandRepository,
  IMusicianRepository,
  MusicianFilter,
  MusicianSearchParams,
} from "@core/musician/domain";
import {
  BandOutput,
  BandOutputMapper,
} from "@core/musician/application/use-cases/common/band-output";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "@core/musician/application/use-cases/common/musician-profile-output";
import {
  PaginationOutput,
  PaginationOutputMapper,
} from "@core/shared/application/pagination-output";
import { IUseCase } from "@core/shared/application/use-case.interface";
import { NotFoundError } from "@core/shared/domain/errors/not-found.error";

import {
  EstablishmentOutput,
  EstablishmentOutputMapper,
} from "../common/establishment-output";
import { GetHiringDashboardInput } from "./get-hiring-dashboard.input";
import { HiringDashboardOutput } from "./get-hiring-dashboard.output";

export class GetHiringDashboardUseCase implements IUseCase<
  GetHiringDashboardInput,
  HiringDashboardOutput
> {
  constructor(
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly musicianRepo: IMusicianRepository,
    private readonly bandRepo: IBandRepository,
    private readonly eventRepo: IEventRepository,
  ) {}

  async execute(
    input: GetHiringDashboardInput,
  ): Promise<HiringDashboardOutput> {
    const establishmentId = new EstablishmentId(input.establishment_id);
    const establishment =
      await this.establishmentRepo.findById(establishmentId);

    if (!establishment) {
      throw new NotFoundError(input.establishment_id, Establishment);
    }

    const establishmentOutput =
      EstablishmentOutputMapper.toOutput(establishment);

    const compatibleMusicians = await this.listCompatibleMusicians(
      establishmentOutput,
      input,
    );

    const compatibleBands = await this.listCompatibleBands(
      establishmentOutput,
      input,
    );

    const eventHistory = await this.listEventHistory(
      establishmentOutput,
      input,
    );

    const recommendations = this.buildRecommendations(
      compatibleMusicians,
      compatibleBands,
    );

    return {
      establishment: establishmentOutput,
      compatible_musicians: compatibleMusicians,
      compatible_bands: compatibleBands,
      event_history: eventHistory,
      recommendations,
      applied_filters: input.filters ?? null,
    };
  }

  private async listCompatibleMusicians(
    establishment: EstablishmentOutput,
    input: GetHiringDashboardInput,
  ): Promise<PaginationOutput<MusicianOutput>> {
    const filter: MusicianFilter = {
      genres:
        input.filters?.musician_filter?.genres ??
        establishment.profile?.preferred_genres ??
        null,
      instruments: input.filters?.musician_filter?.instruments ?? null,
      price_min: input.filters?.musician_filter?.price_min ?? null,
      price_max: input.filters?.musician_filter?.price_max ?? null,
      price_model: input.filters?.musician_filter?.price_model ?? null,
      price_currency: input.filters?.musician_filter?.price_currency ?? null,
      is_active: true,
      is_verified: true,
    };

    // Gate de consentimento via único ponto de aplicação — este dashboard é
    // outro "radar" de contratação, não pode vazar músicos que não optaram
    // por aparecer.
    const params = MusicianSearchParams.createPublic({
      page: input.musicians_page,
      per_page: input.musicians_per_page,
      sort: input.musicians_sort ?? "rating",
      sort_dir: input.musicians_sort_dir ?? "desc",
      filter,
    });

    const searchResult = await this.musicianRepo.search(params);
    const items = searchResult.items.map((item) =>
      MusicianOutputMapper.toOutput(item),
    );

    return PaginationOutputMapper.toOutput(items, searchResult);
  }

  private async listCompatibleBands(
    establishment: EstablishmentOutput,
    input: GetHiringDashboardInput,
  ): Promise<PaginationOutput<BandOutput>> {
    const filter: BandFilter = {
      genres:
        input.filters?.band_filter?.genres ??
        establishment.profile?.preferred_genres ??
        null,
      price_min: input.filters?.band_filter?.price_min ?? null,
      price_max: input.filters?.band_filter?.price_max ?? null,
      price_model: input.filters?.band_filter?.price_model ?? null,
      price_currency: input.filters?.band_filter?.price_currency ?? null,
      is_active: true,
    };

    // Gate de consentimento via único ponto de aplicação — mesmo raciocínio
    // acima, para bandas.
    const params = BandSearchParams.createPublic({
      page: input.bands_page,
      per_page: input.bands_per_page,
      sort: input.bands_sort ?? "created_at",
      sort_dir: input.bands_sort_dir ?? "desc",
      filter,
    });

    const searchResult = await this.bandRepo.search(params);
    // Só a formação confirmada é "contratável" — convites pending/declined
    // não são membros reais da banda (mesmo raciocínio de acceptedMembers
    // já aplicado em confirm-tip-payment/confirm-booking).
    const items = searchResult.items.map((band) => {
      const output = BandOutputMapper.toOutput(band);
      return {
        ...output,
        members: output.members.filter((m) => m.status === "accepted"),
      };
    });

    return PaginationOutputMapper.toOutput(items, searchResult);
  }

  private async listEventHistory(
    establishment: EstablishmentOutput,
    input: GetHiringDashboardInput,
  ): Promise<PaginationOutput<EventOutput>> {
    const baseFilter: EventFilter = {
      establishment_id: establishment.id,
      ...(input.filters?.event_filter ?? {}),
    } as any;

    if (input.filters?.date_range) {
      baseFilter.date_gte = input.filters.date_range.start_at;
      baseFilter.date_lte = input.filters.date_range.end_at;
    }

    const params = EventSearchParams.create({
      page: input.events_page,
      per_page: input.events_per_page,
      sort: input.events_sort ?? "date",
      sort_dir: input.events_sort_dir ?? "desc",
      filter: baseFilter,
    });

    const searchResult = await this.eventRepo.search(params);
    const items = searchResult.items.map((event) =>
      EventOutputMapper.toOutput(event),
    );

    return PaginationOutputMapper.toOutput(items, searchResult);
  }

  private buildRecommendations(
    musicians: PaginationOutput<MusicianOutput>,
    bands: PaginationOutput<BandOutput>,
  ) {
    return {
      top_musicians: musicians.items.slice(0, 5),
      top_bands: bands.items.slice(0, 5),
    };
  }
}
