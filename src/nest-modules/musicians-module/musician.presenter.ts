import { Transform } from "class-transformer";

import { MusicianOutput } from "../../core/musician/application/use-cases/common/musician-profile-output";
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
  qr_customization: MusicianOutput["qr_customization"];
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  open_to_gigs: boolean | null;
  genres: string[];
  instruments: string[];
  experience_years: number;
  profile: MusicianOutput["profile"];
  display_name: string;
  is_experienced: boolean;
  is_highly_rated: boolean;
  plan_tier?: string;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: MusicianOutput) {
    this.id = output.id;
    this.email = output.email;
    this.name = output.name;
    this.stage_name = output.stage_name;
    this.bio = output.bio;
    this.avatar = output.avatar;
    this.phone = output.phone;
    this.qr_code = output.qr_code;
    this.qr_customization = output.qr_customization;
    this.plan_tier = output.plan_tier;
    this.rating = output.rating;
    this.total_ratings = output.total_ratings;
    this.is_active = output.is_active;
    this.is_verified = output.is_verified;
    this.open_to_gigs = output.open_to_gigs;
    this.genres = output.genres;
    this.instruments = output.instruments;
    this.experience_years = output.experience_years;
    this.profile = output.profile;
    this.display_name = output.display_name;
    this.is_experienced = output.is_experienced;
    this.is_highly_rated = output.is_highly_rated;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

// Versão sem PII (email/phone) — usada em toda visão pública/de terceiro:
// GET /musicians (lista, sempre) e GET /musicians/:id quando quem chama não é
// o próprio músico nem admin. O dono continua recebendo MusicianPresenter
// completo através da mesma rota, condicionado no controller (ver findOne).
export class PublicMusicianPresenter {
  id: string;
  name: string;
  stage_name: string | null;
  bio: string | null;
  avatar: string | null;
  qr_code: string | null;
  qr_customization: MusicianOutput["qr_customization"];
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  open_to_gigs: boolean | null;
  genres: string[];
  instruments: string[];
  experience_years: number;
  profile: MusicianOutput["profile"];
  display_name: string;
  is_experienced: boolean;
  is_highly_rated: boolean;
  plan_tier?: string;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: MusicianOutput) {
    this.id = output.id;
    this.name = output.name;
    this.stage_name = output.stage_name;
    this.bio = output.bio;
    this.avatar = output.avatar;
    this.qr_code = output.qr_code;
    this.qr_customization = output.qr_customization;
    this.plan_tier = output.plan_tier;
    this.rating = output.rating;
    this.total_ratings = output.total_ratings;
    this.is_active = output.is_active;
    this.is_verified = output.is_verified;
    this.open_to_gigs = output.open_to_gigs;
    this.genres = output.genres;
    this.instruments = output.instruments;
    this.experience_years = output.experience_years;
    this.profile = output.profile;
    this.display_name = output.display_name;
    this.is_experienced = output.is_experienced;
    this.is_highly_rated = output.is_highly_rated;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class MusicianCollectionPresenter extends CollectionPresenter {
  data: PublicMusicianPresenter[];

  constructor(output: ListMusiciansOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new PublicMusicianPresenter(i));
  }
}
