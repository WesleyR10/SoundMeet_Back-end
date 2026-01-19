import { Transform } from "class-transformer";

import {
  EstablishmentOutput,
  EstablishmentProfileOutput,
} from "../../core/establishment/application/use-cases/common/establishment-output";
import { ListEstablishmentsOutput } from "../../core/establishment/application/use-cases/list-establishments/list-establishments.use-case";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class EstablishmentPresenter {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  cnpj: EstablishmentOutput["cnpj"];
  email: string;
  phone: string | null;
  website: string | null;
  establishment_type: "bar" | "restaurant" | "club";
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  profile: EstablishmentProfilePresenter | null;
  qr_code: string | null;
  is_highly_rated: boolean;
  is_popular: boolean;
  is_bar: boolean;
  is_restaurant: boolean;
  is_club: boolean;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: EstablishmentOutput) {
    this.id = output.id;
    this.name = output.name;
    this.description = output.description;
    this.avatar = output.avatar;
    this.cnpj = output.cnpj;
    this.email = output.email;
    this.phone = output.phone;
    this.website = output.website;
    this.establishment_type = output.establishment_type as
      | "bar"
      | "restaurant"
      | "club";
    this.rating = output.rating;
    this.total_ratings = output.total_ratings;
    this.is_active = output.is_active;
    this.is_verified = output.is_verified;
    this.profile = output.profile
      ? new EstablishmentProfilePresenter(output.profile)
      : null;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
    this.qr_code = output.qr_code;
    this.is_highly_rated = output.is_highly_rated;
    this.is_popular = output.is_popular;
    this.is_bar = output.is_bar;
    this.is_restaurant = output.is_restaurant;
    this.is_club = output.is_club;
  }
}

export class EstablishmentProfilePresenter {
  id: string;
  establishment_id: string;
  capacity: number | null;
  location: Record<string, unknown>;
  amenities: string[];
  preferred_genres: string[];
  operating_hours: Record<string, unknown> | null;
  price_range: EstablishmentProfileOutput["price_range"];
  social_links: Record<string, unknown> | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: EstablishmentProfileOutput) {
    this.id = output.id;
    this.establishment_id = output.establishment_id;
    this.capacity = output.capacity;
    this.location = output.location;
    this.amenities = output.amenities;
    this.preferred_genres = output.preferred_genres;
    this.operating_hours = output.operating_hours;
    this.price_range = output.price_range;
    this.social_links = output.social_links;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class EstablishmentCollectionPresenter extends CollectionPresenter {
  data: EstablishmentPresenter[];

  constructor(output: ListEstablishmentsOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new EstablishmentPresenter(i));
  }
}
