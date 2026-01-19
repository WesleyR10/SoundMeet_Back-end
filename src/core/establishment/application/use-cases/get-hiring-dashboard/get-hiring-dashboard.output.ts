import { EventOutput } from "@core/events/application/use-cases/common/event-output";
import { MusicianOutput } from "@core/musician/application/use-cases";
import { BandOutput } from "@core/musician/application/use-cases/common/band-output";
import { PaginationOutput } from "@core/shared/application/pagination-output";

import { EstablishmentOutput } from "../common/establishment-output";
import { HiringDashboardFiltersInput } from "./get-hiring-dashboard.input";

export type HiringDashboardRecommendationsOutput = {
  top_musicians: MusicianOutput[];
  top_bands: BandOutput[];
};

export type HiringDashboardOutput = {
  establishment: EstablishmentOutput;
  compatible_musicians: PaginationOutput<MusicianOutput>;
  compatible_bands: PaginationOutput<BandOutput>;
  event_history: PaginationOutput<EventOutput>;
  recommendations: HiringDashboardRecommendationsOutput;
  applied_filters: HiringDashboardFiltersInput | null;
};
