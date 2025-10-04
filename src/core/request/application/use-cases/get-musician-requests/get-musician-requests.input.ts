import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  validateSync,
} from "class-validator";

export enum MusicianRequestsStatusFilter {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  ALL = "all",
}

export type GetMusicianRequestsInputConstructorProps = {
  musician_id: string;
  status?: MusicianRequestsStatusFilter;
  page?: number;
  per_page?: number;
  limit?: number; // Para compatibilidade com testes existentes
};

export class GetMusicianRequestsInput {
  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsEnum(MusicianRequestsStatusFilter)
  @IsOptional()
  status?: MusicianRequestsStatusFilter = MusicianRequestsStatusFilter.ALL;

  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @IsOptional()
  per_page?: number = 15;

  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number; // Para compatibilidade com testes existentes

  constructor(props: GetMusicianRequestsInputConstructorProps) {
    if (!props) return;

    this.musician_id = props.musician_id;
    this.status = props.status ?? MusicianRequestsStatusFilter.ALL;
    this.page = props.page ?? 1;
    this.per_page = props.per_page ?? 15;
    this.limit = props.limit;
  }
}

export class ValidateGetMusicianRequestsInput {
  static validate(input: GetMusicianRequestsInput) {
    return validateSync(input);
  }
}
