import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";

import { IsSocialLink } from "../../../../shared/application/validators/is-social-link.validator";
import { PriceRangeInput } from "../common/price-range.input";

export { PriceRangeInput };

export class LocationInput {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  // Endereço detalhado opcional (autofill via CEP/ViaCEP no app) — perfis
  // antigos com só city/state continuam válidos.
  @IsOptional()
  @IsString()
  street?: string | null;

  @IsOptional()
  @IsString()
  number?: string | null;

  @IsOptional()
  @IsString()
  complement?: string | null;

  @IsOptional()
  @IsString()
  neighborhood?: string | null;

  // Aceita "01310-100" ou "01310100"; o VO normaliza para 8 dígitos.
  @IsOptional()
  @Matches(/^\d{5}-?\d{3}$/, { message: "zip_code must be a valid CEP" })
  zip_code?: string | null;
}

/**
 * 🔴 INP-2: era `Record<string, unknown>` com `@IsObject()` — ou seja, qualquer
 * chave e qualquer valor, incluindo `javascript:alert(1)` e
 * `http://169.254.169.254/`, gravados verbatim por `changeSocialLinks`.
 *
 * A forma do payload é preservada de propósito (`{instagram?, youtube?,
 * spotify?}`, exatamente o que `useEditProfileSectionSubmits.ts` envia); o que
 * muda é que agora cada valor é validado, e chave desconhecida é descartada
 * pelo `whitelist: true` do ValidationPipe global.
 */
export class SocialLinksInput {
  @IsOptional()
  @IsSocialLink("instagram")
  instagram?: string;

  @IsOptional()
  @IsSocialLink("youtube")
  youtube?: string;

  @IsOptional()
  @IsSocialLink("spotify")
  spotify?: string;
}

/** O que `PATCH /musicians/:id/profile` aceita: preço, base e redes. */
export class UpdateMusicianProfileInput {
  @IsUUID()
  id: string;

  // Até uma faixa por modelo (per_hour e per_event) — substitui o conjunto
  // inteiro a cada update; null limpa tudo.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => PriceRangeInput)
  priceRanges?: PriceRangeInput[] | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationInput)
  location?: LocationInput;

  /*
   * 🔴 `experience`, `instruments` e `genres` NÃO entram por aqui (out/2026).
   * São do `Musician` e têm uma porta só: `PATCH /musicians/:id`
   * (`experience_years`, `instruments`, `genres`). Esta rota os aceitava
   * também — os dois últimos regravavam o que a outra rota já gravava, e
   * `experience` não gravava nada, respondendo 200. Com
   * `forbidNonWhitelisted`, mandá-los agora responde 422.
   */

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SocialLinksInput)
  socialLinks?: SocialLinksInput | null;
}
