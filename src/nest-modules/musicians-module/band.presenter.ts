import { Transform } from "class-transformer";

import { BandOutput } from "../../core/musician/application/use-cases/common/band-output";
import { ListBandsOutput } from "../../core/musician/application/use-cases/list-bands/list-bands.use-case";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class BandPresenter {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  genres: string[];
  members: BandOutput["members"];
  priceRange: BandOutput["priceRange"];
  is_active: boolean;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: BandOutput) {
    this.id = output.id;
    this.name = output.name;
    this.description = output.description;
    this.avatar = output.avatar;
    this.genres = output.genres;
    this.members = output.members;
    this.priceRange = output.priceRange;
    this.is_active = output.is_active;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class BandCollectionPresenter extends CollectionPresenter {
  data: BandPresenter[];

  constructor(output: ListBandsOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new BandPresenter(i));
  }
}
