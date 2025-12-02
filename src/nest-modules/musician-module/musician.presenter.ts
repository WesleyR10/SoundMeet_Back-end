import { Transform } from "class-transformer";
import { MusicianOutput } from "../../core/musician/application/use-cases/common/musician-output";
import { ListMusiciansOutput } from "../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class MusicianPresenter {
  id: string;
  email: string;
  name: string;
  stage_name: string | null;
  phone: string | null;
  qr_code: string;
  is_active: boolean;
  is_verified: boolean;
  genres: string[];
  instruments: string[];
  experience_years: number;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: MusicianOutput) {
    this.id = output.id;
    this.email = output.email;
    this.name = output.name;
    this.stage_name = output.stage_name;
    this.phone = output.phone;
    this.qr_code = output.qr_code;
    this.is_active = output.is_active;
    this.is_verified = output.is_verified;
    this.genres = output.genres;
    this.instruments = output.instruments;
    this.experience_years = output.experience_years;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
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
