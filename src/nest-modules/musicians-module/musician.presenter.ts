import { Transform } from "class-transformer";

import { MusicianOutput } from "../../core/musician/application/use-cases/common/musician-output";
import { ListMusiciansOutput } from "../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class MusicianPresenter {
  id: string;
  email: string;
  name: string;
  stage_name: string | null;
  bio: string | null;
  avatar: string | null;
  phone: string | null;
  qr_code: string | null;
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  genres: string[];
  instruments: string[];
  experience_years: number;
  display_name: string;
  is_experienced: boolean;
  is_highly_rated: boolean;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;

  constructor(output: MusicianOutput) {
    this.id = output.id;
    this.email = output.email;
    this.name = output.name;
    this.stage_name = output.stage_name;
    this.bio = output.bio;
    this.avatar = output.avatar;
    this.phone = output.phone;
    this.qr_code = output.qr_code;
    this.rating = output.rating;
    this.total_ratings = output.total_ratings;
    this.is_active = output.is_active;
    this.is_verified = output.is_verified;
    this.genres = output.genres;
    this.instruments = output.instruments;
    this.experience_years = output.experience_years;
    this.display_name = output.display_name;
    this.is_experienced = output.is_experienced;
    this.is_highly_rated = output.is_highly_rated;
    this.created_at = output.created_at;
  }
}

export class MusicianCollectionPresenter extends CollectionPresenter {
  data: MusicianPresenter[];

  constructor(output: ListMusiciansOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new MusicianPresenter(i));
  }
}
