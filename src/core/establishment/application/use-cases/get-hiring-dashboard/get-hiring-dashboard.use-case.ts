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
  ): Promise<PaginationOutput<any>> {
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

    const params = MusicianSearchParams.create({
      page: input.musicians_page,
      per_page: input.musicians_per_page,
      sort: input.musicians_sort ?? "rating",
      sort_dir: input.musicians_sort_dir ?? "desc",
      filter,
    });

    const searchResult = await this.musicianRepo.search(params);
    const items = searchResult.items.map((item) => ({
      id: item.musician_id.id,
      name: item.name,
      email: item.email.value,
      stage_name: item.stage_name,
      bio: item.bio,
      avatar: item.avatar,
      phone: item.phone?.value ?? null,
      genres: item.genres,
      instruments: item.instruments,
      experience_years: item.experience_years,
      qr_code: item.qr_code?.code ?? null,
      rating: item.rating.value,
      total_ratings: item.total_ratings,
      is_active: item.is_active,
      is_verified: item.is_verified,
      profile: item.profile
        ? {
            id: item.profile.profile_id.id,
            musician_id: item.profile.musician_id.id,
            price_range: item.profile.priceRange
              ? {
                  model: item.profile.priceRange.model,
                  min: item.profile.priceRange.min,
                  max: item.profile.priceRange.max,
                  currency: item.profile.priceRange.currency,
                  notes: item.profile.priceRange.notes,
                }
              : null,
            location: item.profile.location.toJSON(),
            social_links: item.profile.socialLinks,
            experience: item.profile.experience,
            instruments: item.profile.instruments,
            genres: item.profile.genres,
            created_at: item.profile.created_at,
            updated_at: item.profile.updated_at,
          }
        : null,
      created_at: item.created_at,
      updated_at: item.updated_at,
      display_name: item.displayName,
      is_experienced: item.isExperienced,
      is_highly_rated: item.isHighlyRated,
    }));

    return PaginationOutputMapper.toOutput(items, searchResult);
  }

  private async listCompatibleBands(
    establishment: EstablishmentOutput,
    input: GetHiringDashboardInput,
  ): Promise<PaginationOutput<any>> {
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

    const params = BandSearchParams.create({
      page: input.bands_page,
      per_page: input.bands_per_page,
      sort: input.bands_sort ?? "created_at",
      sort_dir: input.bands_sort_dir ?? "desc",
      filter,
    });

    const searchResult = await this.bandRepo.search(params);
    const items = searchResult.items.map((band) => ({
      id: band.band_id.id,
      name: band.name,
      description: band.description,
      avatar: band.avatar,
      genres: band.genres,
      members: band.members.map((member) => ({
        member_id: member.member_id!.id,
        musician_id: member.musician_id.id,
        role: member.role,
        instrument: member.instrument,
        joined_at: member.joined_at,
      })),
      priceRange: band.priceRange
        ? {
            model: band.priceRange.model,
            min: band.priceRange.min,
            max: band.priceRange.max,
            currency: band.priceRange.currency,
            notes: band.priceRange.notes,
          }
        : null,
      is_active: band.is_active,
      created_at: band.created_at,
      updated_at: band.updated_at,
    }));

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
    musicians: PaginationOutput<any>,
    bands: PaginationOutput<any>,
  ) {
    return {
      top_musicians: musicians.items.slice(0, 5),
      top_bands: bands.items.slice(0, 5),
    };
  }
}
