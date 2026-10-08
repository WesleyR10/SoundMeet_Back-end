import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

export type UpdateMusicianInputConstructorProps = {
  id: string;
  email?: string;
  name?: string;
  stage_name?: string;
  bio?: string;
  phone?: string;
  cnpj?: string | null;
  genres?: string[];
  instruments?: string[];
  experience_years?: number;
};

/** Teto de itens em `genres`/`instruments` — folga sobre os catálogos do app. */
const MAX_TAGS = 50;
/** Um rótulo de gênero ou instrumento; nenhum do catálogo chega perto. */
const MAX_TAG_LENGTH = 60;

/**
 * O que `PATCH /musicians/:id` aceita: a IDENTIDADE do músico.
 *
 * 🔴 Quatro campos saíram daqui em out/2026, e nenhum cliente os mandava:
 *
 * - **`avatar`** — a foto tem rota própria (`POST :id/avatar`), que valida
 *   tamanho e formato e sobe o arquivo. Aceitar uma URL livre aqui contornava
 *   tudo isso: qualquer endereço virava a foto do perfil, carregado pelo app
 *   de cada fã que abrisse o artista. É a mesma decisão já tomada para
 *   `logo_url` do QR e para o `avatar` do estabelecimento.
 * - **`is_active`** — desativar é ato de moderação. Com o campo no corpo, o
 *   músico reativava sozinho um perfil que um admin tivesse desligado.
 * - **`open_to_gigs`** — é consentimento e tem rota própria
 *   (`PATCH :id/open-to-gigs`).
 * - **`priceRanges`** — a faixa de preço mora em `PATCH :id/profile`.
 *
 * Um campo, uma porta. Com `forbidNonWhitelisted`, mandar qualquer um deles
 * agora responde 422 em vez de ser aceito por um caminho que ninguém olhava.
 */
export class UpdateMusicianInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  stage_name?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  bio?: string;

  @IsString()
  @MaxLength(20)
  @IsOptional()
  phone?: string;

  /**
   * CNPJ do MEI. `null` remove e o músico volta a contratar como pessoa física.
   *
   * `ValidateIf` em vez de `IsOptional` porque `IsOptional` também deixaria
   * passar `null` sem validar — e aqui `null` é um comando legítimo (baixou o
   * MEI), enquanto string inválida não é. Os dígitos verificadores são
   * conferidos pelo VO `CNPJ` no agregado.
   */
  @ValidateIf((_o, value) => value !== null && value !== undefined)
  @IsString()
  @IsNotEmpty()
  cnpj?: string | null;

  @IsArray()
  @ArrayMaxSize(MAX_TAGS)
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LENGTH, { each: true })
  @IsOptional()
  genres?: string[];

  @IsArray()
  @ArrayMaxSize(MAX_TAGS)
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LENGTH, { each: true })
  @IsOptional()
  instruments?: string[];

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  experience_years?: number;

  constructor(props: UpdateMusicianInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.email = props.email;
    this.name = props.name;
    this.stage_name = props.stage_name;
    this.bio = props.bio;
    this.phone = props.phone;
    this.cnpj = props.cnpj;
    this.genres = props.genres;
    this.instruments = props.instruments;
    this.experience_years = props.experience_years;
  }
}
