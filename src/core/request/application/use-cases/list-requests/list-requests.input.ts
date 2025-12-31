import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  validateSync,
} from "class-validator";

export enum RequestStatusFilter {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

export type ListRequestsInputConstructorProps = {
  page?: number;
  per_page?: number;
  sort?: string;
  sort_dir?: "asc" | "desc";
  filter?: {
    audience_id?: string;
    musician_id?: string;
    status?: RequestStatusFilter;
    song_title?: string;
    artist?: string;
    created_after?: string;
    created_before?: string;
  };
};

export class ListRequestsInput {
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @IsOptional()
  per_page?: number = 15;

  @IsString()
  @IsOptional()
  sort?: string;

  @IsEnum(["asc", "desc"])
  @IsOptional()
  sort_dir?: "asc" | "desc";

  @IsUUID()
  @IsOptional()
  audience_id?: string;

  @IsUUID()
  @IsOptional()
  musician_id?: string;

  @IsEnum(RequestStatusFilter)
  @IsOptional()
  status?: RequestStatusFilter;

  @IsString()
  @IsOptional()
  song_title?: string;

  @IsString()
  @IsOptional()
  artist?: string;

  @IsDateString()
  @IsOptional()
  created_after?: string;

  @IsDateString()
  @IsOptional()
  created_before?: string;

  constructor(props: ListRequestsInputConstructorProps) {
    if (!props) return;

    this.page = props.page ?? 1;
    this.per_page = props.per_page ?? 15;
    this.sort = props.sort;
    this.sort_dir = props.sort_dir;

    if (props.filter) {
      this.audience_id = props.filter.audience_id;
      this.musician_id = props.filter.musician_id;
      this.status = props.filter.status;
      this.song_title = props.filter.song_title;
      this.artist = props.filter.artist;
      this.created_after = props.filter.created_after;
      this.created_before = props.filter.created_before;
    }
  }
}

export class ValidateListRequestsInput {
  static validate(input: ListRequestsInput) {
    return validateSync(input);
  }
}
