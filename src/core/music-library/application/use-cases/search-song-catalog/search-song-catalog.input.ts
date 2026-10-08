import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export type SearchSongCatalogInputProps = {
  musician_id: string;
  term?: string | null;
  limit?: number;
};

export class SearchSongCatalogInput {
  @IsString()
  musician_id: string;

  /**
   * `MaxLength` porque o termo vira `ILIKE %termo%`: sem teto, uma string de
   * megabytes viraria varredura sequencial na tabela inteira por requisição.
   */
  @IsString()
  @IsOptional()
  @MaxLength(120)
  term?: string | null;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(50)
  limit?: number;

  constructor(props: SearchSongCatalogInputProps) {
    if (!props) return;
    this.musician_id = props.musician_id;
    this.term = props.term;
    this.limit = props.limit;
  }
}
