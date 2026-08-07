import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";

import { HiringDashboardOutput } from "../../core/establishment/application/use-cases/get-hiring-dashboard/get-hiring-dashboard.output";
import { BandOutput } from "../../core/musician/application/use-cases/common/band-output";
import {
  MusicianOutput,
  MusicianProfileOutput,
} from "../../core/musician/application/use-cases/common/musician-profile-output";
import { EventPresenter } from "../events-module/event.presenter";
import { EstablishmentPresenter } from "./establishment.presenter";

export class HiringDashboardMusicianPresenter {
  id: string;
  name: string;
  stage_name: string | null;
  avatar: string | null;
  genres: string[];
  instruments: string[];
  rating: number;
  total_ratings: number;
  is_verified: boolean;

  // Tipo TS é um array de objeto anônimo (indexed access), então o
  // `design:type` emitido é só `Array` — o SchemaObjectFactory do
  // @nestjs/swagger 11 tenta resolver o elemento e aborta com "circular
  // dependency", derrubando o documento inteiro. `type` explícito resolve.
  @ApiProperty({
    type: "array",
    items: {
      type: "object",
      properties: {
        model: { type: "string" },
        min: { type: "number" },
        max: { type: "number" },
        currency: { type: "string" },
        notes: { type: "string", nullable: true },
      },
    },
  })
  price_ranges: MusicianProfileOutput["price_ranges"];

  constructor(output: MusicianOutput) {
    this.id = output.id;
    this.name = output.name;
    this.stage_name = output.stage_name;
    this.avatar = output.avatar;
    this.genres = output.genres;
    this.instruments = output.instruments;
    this.rating = output.rating;
    this.total_ratings = output.total_ratings;
    this.is_verified = output.is_verified;
    this.price_ranges = output.profile?.price_ranges ?? [];
  }
}

export class HiringDashboardBandPresenter {
  id: string;
  name: string;
  avatar: string | null;
  genres: string[];
  price_range: BandOutput["priceRange"] | null;

  constructor(output: BandOutput) {
    this.id = output.id;
    this.name = output.name;
    this.avatar = output.avatar;
    this.genres = output.genres;
    this.price_range = output.priceRange;
  }
}

export class HiringDashboardRecommendationsPresenter {
  @Type(() => HiringDashboardMusicianPresenter)
  top_musicians: HiringDashboardMusicianPresenter[];

  @Type(() => HiringDashboardBandPresenter)
  top_bands: HiringDashboardBandPresenter[];

  constructor(output: HiringDashboardOutput["recommendations"]) {
    this.top_musicians = output.top_musicians.map(
      (m) => new HiringDashboardMusicianPresenter(m),
    );
    this.top_bands = output.top_bands.map(
      (b) => new HiringDashboardBandPresenter(b),
    );
  }
}

export class HiringDashboardPresenter {
  @Type(() => EstablishmentPresenter)
  establishment: EstablishmentPresenter;

  @Type(() => HiringDashboardMusicianPresenter)
  compatible_musicians: HiringDashboardMusicianPresenter[];

  @Type(() => HiringDashboardBandPresenter)
  compatible_bands: HiringDashboardBandPresenter[];

  @Type(() => EventPresenter)
  event_history: EventPresenter[];

  @Type(() => HiringDashboardRecommendationsPresenter)
  recommendations: HiringDashboardRecommendationsPresenter;

  @Transform(({ value }) => value ?? null)
  applied_filters: HiringDashboardOutput["applied_filters"] | null;

  constructor(output: HiringDashboardOutput) {
    this.establishment = new EstablishmentPresenter(output.establishment);
    this.compatible_musicians = output.compatible_musicians.items.map(
      (m) => new HiringDashboardMusicianPresenter(m),
    );
    this.compatible_bands = output.compatible_bands.items.map(
      (b) => new HiringDashboardBandPresenter(b),
    );
    this.event_history = output.event_history.items.map(
      (e) => new EventPresenter(e),
    );
    this.recommendations = new HiringDashboardRecommendationsPresenter(
      output.recommendations,
    );
    this.applied_filters = output.applied_filters;
  }
}
