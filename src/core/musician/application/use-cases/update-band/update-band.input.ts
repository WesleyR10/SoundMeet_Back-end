import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
  validateSync,
} from "class-validator";

import { IsFormationYear } from "../../../domain/formation-year";
import {
  BAND_DESCRIPTION_MAX_LENGTH,
  BAND_MAX_GENRE_LENGTH,
  BAND_MAX_GENRES,
  BAND_NAME_MAX_LENGTH,
  CreateBandPriceRangeInput,
} from "../create-band/create-band.input";
import { LocationInput } from "../update-musician-profile/update-musician-profile.input";

/** Mesma forma da criação — uma faixa de preço é uma faixa de preço. */
export class UpdateBandPriceRangeInput extends CreateBandPriceRangeInput {}

export type UpdateBandInputConstructorProps = {
  id: string;
  name?: string;
  description?: string | null;
  genres?: string[];
  formed_in?: number | null;
  priceRange?: UpdateBandPriceRangeInput | null;
  address?: LocationInput | null;
  requesting_musician_id?: string | null;
  is_admin?: boolean;
};

/**
 * O que `PATCH /bands/:id` aceita: os dados de apresentação da banda.
 *
 * 🔴 Três campos saíram daqui em out/2026, e nenhum cliente os mandava:
 *
 * - **`open_to_gigs`** — é consentimento e tem rota própria
 *   (`PATCH :id/open-to-gigs`). Duas portas para o mesmo campo divergem em
 *   silêncio.
 * - **`is_active`** — `false` é "banda dissolvida" e só nasce de
 *   `DELETE /bands/:id` (`Band.archive`). Com o campo aqui, o líder reativava
 *   sozinho uma banda arquivada, ou a desativava sem passar pela checagem de
 *   shows em aberto.
 * - **`avatar`** — não há upload de foto de banda. Uma URL livre viraria a
 *   imagem carregada pelo painel de todo estabelecimento que abrisse a banda.
 *
 * `requesting_musician_id` e `is_admin` vêm do token; o DTO não os expõe.
 */
export class UpdateBandInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(BAND_NAME_MAX_LENGTH)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(BAND_DESCRIPTION_MAX_LENGTH)
  @IsOptional()
  description?: string | null;

  @IsArray()
  @ArrayMaxSize(BAND_MAX_GENRES)
  @IsString({ each: true })
  @MaxLength(BAND_MAX_GENRE_LENGTH, { each: true })
  @IsOptional()
  genres?: string[];

  /**
   * Ano de formação. Aceita `null` para APAGAR o valor — quem digitou o ano
   * errado precisa de caminho de volta ao "não informado", senão fica preso a
   * um número falso numa tela que o estabelecimento lê como credencial.
   *
   * ⚠️ Por isso o use-case testa `!== undefined` e não truthiness: com
   * truthiness, `null` (apagar) e `0` seriam indistinguíveis de "não mandei".
   */
  @IsFormationYear()
  @IsOptional()
  formed_in?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBandPriceRangeInput)
  priceRange?: UpdateBandPriceRangeInput | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationInput)
  address?: LocationInput | null;

  // `sub` do JWT — só o líder atual altera a banda.
  @IsUUID()
  @IsOptional()
  requesting_musician_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props: UpdateBandInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.genres = props.genres;
    this.formed_in = props.formed_in;
    this.priceRange = props.priceRange;
    this.address = props.address;
    this.requesting_musician_id = props.requesting_musician_id;
    this.is_admin = props.is_admin ?? false;
  }

  validate() {
    return validateSync(this);
  }
}
