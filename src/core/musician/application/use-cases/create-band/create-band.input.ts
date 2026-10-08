import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { Currency } from "../../../../shared/domain/value-objects/money.vo";
import { IsFormationYear } from "../../../domain/formation-year";
import { LocationInput } from "../update-musician-profile/update-musician-profile.input";

/** Teto de itens em `genres` — folga sobre o catálogo do app. */
export const BAND_MAX_GENRES = 50;
/** Um rótulo de gênero; nenhum do catálogo chega perto. */
export const BAND_MAX_GENRE_LENGTH = 60;
export const BAND_NAME_MAX_LENGTH = 255;
export const BAND_DESCRIPTION_MAX_LENGTH = 2000;

export class CreateBandPriceRangeInput {
  @IsIn(["per_event", "per_hour"])
  model: "per_event" | "per_hour";

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  min: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  max: number;

  @IsIn(Object.values(Currency))
  @IsOptional()
  currency?: Currency;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string | null;
}

export type CreateBandInputConstructorProps = {
  name: string;
  description?: string | null;
  genres: string[];
  formed_in?: number | null;
  priceRange?: CreateBandPriceRangeInput | null;
  address?: LocationInput | null;
  open_to_gigs?: boolean | null;
  creator_musician_id?: string;
};

/**
 * O que `POST /bands` aceita.
 *
 * 🔴 Quatro campos saíram daqui em out/2026, e nenhum cliente os mandava:
 *
 * - **`members`** — era um `@IsArray()` sem validação aninhada. Quem mandasse
 *   `members: [...]` criava convites sem passar por `InviteBandMemberUseCase`:
 *   sem conferir se o músico existe ou está ativo e, principalmente, sem o
 *   gate de plano (convidar é do PRO). Convite tem rota própria
 *   (`POST /bands/:id/members`) e é a única porta.
 * - **`is_active`** — banda nasce ativa. `false` só existe como resultado de
 *   dissolver uma banda com histórico (`Band.archive`).
 * - **`avatar`** — não há upload de foto de banda; uma URL livre viraria a
 *   imagem carregada pelo painel de todo estabelecimento que abrisse a banda.
 * - **`creator_musician_id` no corpo** — continua no input, mas quem preenche
 *   é o controller, com o `sub` do token. O DTO não o expõe.
 */
export class CreateBandInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(BAND_NAME_MAX_LENGTH)
  name: string;

  @IsString()
  @MaxLength(BAND_DESCRIPTION_MAX_LENGTH)
  @IsOptional()
  description?: string | null;

  @IsArray()
  @ArrayMaxSize(BAND_MAX_GENRES)
  @IsString({ each: true })
  @MaxLength(BAND_MAX_GENRE_LENGTH, { each: true })
  genres: string[];

  // Ano de formação ("tempo de estrada"). Opcional no cadastro de propósito:
  // quem está criando a banda quer criá-la, e exigir o ano ali transformaria
  // uma credencial em obstáculo. Entra depois, em configurações — mesma
  // postura do CNPJ do MEI, que fica fora do `MusicianCreateCommand`.
  @IsFormationYear()
  @IsOptional()
  formed_in?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateBandPriceRangeInput)
  priceRange?: CreateBandPriceRangeInput | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationInput)
  address?: LocationInput | null;

  // Nunca default true — consentimento explícito do líder, decidido depois
  // via PATCH /bands/:id/open-to-gigs se omitido aqui.
  @IsBoolean()
  @IsOptional()
  open_to_gigs?: boolean | null;

  // `sub` do token — preenchido pelo controller, fora do DTO.
  @IsString()
  @IsOptional()
  creator_musician_id?: string;

  constructor(props: CreateBandInputConstructorProps) {
    if (!props) return;
    this.name = props.name;
    this.description = props.description;
    this.genres = props.genres;
    this.formed_in = props.formed_in;
    this.priceRange = props.priceRange;
    this.address = props.address;
    this.open_to_gigs = props.open_to_gigs;
    this.creator_musician_id = props.creator_musician_id;
  }
}
