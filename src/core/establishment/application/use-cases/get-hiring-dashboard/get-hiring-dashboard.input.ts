import { EventFilter } from "@core/events/domain";
import { BandFilter, MusicianFilter } from "@core/musician/domain";
import { SortDirection } from "@core/shared/domain/repository/search-params";
import { Type } from "class-transformer";
import {
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  validateSync,
} from "class-validator";

export class HiringDashboardDateRangeInput {
  @Type(() => Date)
  @IsDate()
  start_at: Date;

  @Type(() => Date)
  @IsDate()
  end_at: Date;
}

export class HiringDashboardFiltersInput {
  @IsOptional()
  @Type(() => HiringDashboardDateRangeInput)
  @ValidateNested()
  date_range?: HiringDashboardDateRangeInput;

  @IsOptional()
  musician_filter?: MusicianFilter | null;

  @IsOptional()
  band_filter?: BandFilter | null;

  @IsOptional()
  event_filter?: Omit<EventFilter, "establishment_id"> | null;
}

export type GetHiringDashboardInputConstructorProps = {
  establishment_id: string;
  musicians_page?: number;
  musicians_per_page?: number;
  musicians_sort?: string | null;
  musicians_sort_dir?: SortDirection | null;
  bands_page?: number;
  bands_per_page?: number;
  bands_sort?: string | null;
  bands_sort_dir?: SortDirection | null;
  events_page?: number;
  events_per_page?: number;
  events_sort?: string | null;
  events_sort_dir?: SortDirection | null;
  filters?: HiringDashboardFiltersInput | null;
};

export class GetHiringDashboardInput {
  @IsString()
  establishment_id: string;

  @IsOptional()
  @IsNumber()
  musicians_page?: number;

  @IsOptional()
  @IsNumber()
  musicians_per_page?: number;

  @IsOptional()
  @IsString()
  musicians_sort?: string | null;

  @IsOptional()
  musicians_sort_dir?: SortDirection | null;

  @IsOptional()
  @IsNumber()
  bands_page?: number;

  @IsOptional()
  @IsNumber()
  bands_per_page?: number;

  @IsOptional()
  @IsString()
  bands_sort?: string | null;

  @IsOptional()
  bands_sort_dir?: SortDirection | null;

  @IsOptional()
  @IsNumber()
  events_page?: number;

  @IsOptional()
  @IsNumber()
  events_per_page?: number;

  @IsOptional()
  @IsString()
  events_sort?: string | null;

  @IsOptional()
  events_sort_dir?: SortDirection | null;

  @IsOptional()
  @Type(() => HiringDashboardFiltersInput)
  @ValidateNested()
  filters?: HiringDashboardFiltersInput | null;

  constructor(props: GetHiringDashboardInputConstructorProps) {
    if (!props) return;
    this.establishment_id = props.establishment_id;
    this.musicians_page = props.musicians_page;
    this.musicians_per_page = props.musicians_per_page;
    this.musicians_sort = props.musicians_sort;
    this.musicians_sort_dir = props.musicians_sort_dir;
    this.bands_page = props.bands_page;
    this.bands_per_page = props.bands_per_page;
    this.bands_sort = props.bands_sort;
    this.bands_sort_dir = props.bands_sort_dir;
    this.events_page = props.events_page;
    this.events_per_page = props.events_per_page;
    this.events_sort = props.events_sort;
    this.events_sort_dir = props.events_sort_dir;
    this.filters = props.filters ?? null;
  }
}

export class ValidateGetHiringDashboardInput {
  static validate(input: GetHiringDashboardInput) {
    return validateSync(input);
  }
}
