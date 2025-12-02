import { Transform } from "class-transformer";
import { EstablishmentOutput } from "../../core/establishment/application/use-cases/common/establishment-output";
import { ListEstablishmentsOutput } from "../../core/establishment/application/use-cases/list-establishments/list-establishments.use-case";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class EstablishmentPresenter {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  cnpj: {
    formatted: string | null;
    value: string | null;
  } | null;
  email: string;
  phone: string | null;
  website: string | null;
  address_street: string;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string;
  address_state: string | null;
  address_zipcode: string | null;
  establishment_type: string;
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  qr_code: string | null;
  is_highly_rated: boolean;
  is_popular: boolean;
  is_bar: boolean;
  is_restaurant: boolean;
  is_club: boolean;

  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;

  constructor(output: EstablishmentOutput) {
    this.id = output.id;
    this.name = output.name;
    this.description = output.description;
    this.avatar = output.avatar;
    this.cnpj = output.cnpj;
    this.email = output.email;
    this.phone = output.phone;
    this.website = output.website;
    this.address_street = output.address_street;
    this.address_number = output.address_number;
    this.address_neighborhood = output.address_neighborhood;
    this.address_city = output.address_city;
    this.address_state = output.address_state;
    this.address_zipcode = output.address_zipcode;
    this.establishment_type = output.establishment_type;
    this.rating = output.rating;
    this.total_ratings = output.total_ratings;
    this.is_active = output.is_active;
    this.is_verified = output.is_verified;
    this.qr_code = output.qr_code;
    this.is_highly_rated = output.is_highly_rated;
    this.is_popular = output.is_popular;
    this.is_bar = output.is_bar;
    this.is_restaurant = output.is_restaurant;
    this.is_club = output.is_club;
    this.created_at = output.created_at;
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
