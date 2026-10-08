import { Transform } from "class-transformer";

import { MusicianOutput } from "../../core/musician/application/use-cases/common/musician-profile-output";
import { MusicianIdentityOutput } from "../../core/musician/application/use-cases/list-musician-identities/list-musician-identities.use-case";
import { ListMusiciansOutput } from "../../core/musician/application/use-cases/list-musicians/list-musicians.use-case";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class MusicianPresenter {
  id: string;
  email: string;
  name: string;
  stage_name: string | null;
  bio: string | null;
  avatar: string | null;
  presentation_audio: MusicianOutput["presentation_audio"];
  phone: string | null;
  cnpj: string | null;
  qr_code: string | null;
  qr_customization: MusicianOutput["qr_customization"];
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  open_to_gigs: boolean | null;
  /**
   * O público pode pedir música fora do repertório deste músico.
   *
   * Sai também no presenter PÚBLICO de propósito: é a tela do fã que
   * decide onde buscar e qual aviso mostrar. Não é PII — descreve como
   * este músico recebe pedidos, exatamente como `open_to_gigs` descreve
   * se ele aceita contratação.
   */
  accepts_requests_outside_repertoire: boolean;
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
    this.presentation_audio = output.presentation_audio;
    this.phone = output.phone;
    this.cnpj = output.cnpj;
    this.qr_code = output.qr_code;
    this.qr_customization = output.qr_customization;
    this.plan_tier = output.plan_tier;
    this.rating = output.rating;
    this.total_ratings = output.total_ratings;
    this.is_active = output.is_active;
    this.is_verified = output.is_verified;
    this.open_to_gigs = output.open_to_gigs;
    this.accepts_requests_outside_repertoire =
      output.accepts_requests_outside_repertoire;
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

type MusicianLocationOutput = NonNullable<
  MusicianOutput["profile"]
>["location"];

/**
 * O que da localização de um músico pode sair para terceiros: CIDADE e ESTADO.
 *
 * 🔴 O `Location` do músico é o ENDEREÇO DE CASA de uma pessoa física (o app
 * preenche por CEP: rua, número, complemento). Até out/2026 o presenter
 * público copiava `profile` inteiro, e `GET /musicians` — rota anônima —
 * entregava rua, número, CEP e a coordenada exata de cada artista. Nenhum
 * cliente lia esses campos: web e app só mostram cidade e estado.
 *
 * Por isso aqui é ALLOWLIST, campo a campo. Um campo novo no VO `Location`
 * não vaza por herança: só sai o que estiver escrito abaixo.
 *
 * **Nenhuma coordenada sai, nem arredondada.** Quem precisa de "a X km"
 * manda a própria posição na busca e recebe `distance_km` pronto, medido na
 * grade pública (`musician-location-privacy.ts`) — o cliente não faz conta
 * com a posição de ninguém.
 */
export type PublicMusicianLocation = {
  city: string | null;
  state: string | null;
};

/** `profile` como terceiros o veem — sem ids internos, datas nem endereço. */
export type PublicMusicianProfile = {
  price_ranges: NonNullable<MusicianOutput["profile"]>["price_ranges"];
  social_links: Record<string, unknown> | null;
  location: PublicMusicianLocation;
  /** Só enquanto o modo turnê está vigente; expirado, sai `null`. */
  touring_location: PublicMusicianLocation | null;
  touring_expires_at: Date | null;
  is_touring: boolean;
};

function toPublicLocation(
  location: MusicianLocationOutput,
): PublicMusicianLocation {
  return {
    city: location.city,
    state: location.state,
  };
}

export function toPublicMusicianProfile(
  profile: MusicianOutput["profile"],
): PublicMusicianProfile | null {
  if (!profile) {
    return null;
  }
  const touring =
    profile.is_touring && profile.touring_location
      ? toPublicLocation(profile.touring_location)
      : null;
  return {
    price_ranges: profile.price_ranges,
    social_links: profile.social_links,
    location: toPublicLocation(profile.location),
    touring_location: touring,
    touring_expires_at: touring ? profile.touring_expires_at : null,
    is_touring: profile.is_touring,
  };
}

// Versão sem PII (email/phone/cnpj/endereço) — o PERFIL de um músico visto por
// terceiro: GET /musicians/:id quando quem chama não é o próprio músico nem
// admin. O dono continua recebendo MusicianPresenter completo através da mesma
// rota, condicionado no controller (ver findOne). As LISTAS usam
// `MusicianCardPresenter`, mais enxuto.
//
// 🔴 `plan_tier` NÃO está aqui: é dado comercial do artista e só as telas do
// próprio dono o leem. Até out/2026 ele saía para qualquer anônimo em
// `GET /musicians/:id`, contradizendo a faixa "Em destaque", que promete não
// expor o tier.
export class PublicMusicianPresenter {
  id: string;
  name: string;
  stage_name: string | null;
  bio: string | null;
  avatar: string | null;
  /**
   * 🔴 Está nos presenters PÚBLICOS de propósito (este e o
   * `MusicianCardPresenter`): é na busca de artistas que o estabelecimento
   * decide contratar. Um preview que só existisse no presenter completo nunca
   * apareceria na grade — o único lugar onde ele importa.
   */
  presentation_audio: MusicianOutput["presentation_audio"];
  qr_code: string | null;
  qr_customization: MusicianOutput["qr_customization"];
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  open_to_gigs: boolean | null;
  /**
   * O público pode pedir música fora do repertório deste músico.
   *
   * Sai também no presenter PÚBLICO de propósito: é a tela do fã que
   * decide onde buscar e qual aviso mostrar. Não é PII — descreve como
   * este músico recebe pedidos, exatamente como `open_to_gigs` descreve
   * se ele aceita contratação.
   */
  accepts_requests_outside_repertoire: boolean;
  genres: string[];
  instruments: string[];
  experience_years: number;
  profile: PublicMusicianProfile | null;
  display_name: string;
  is_experienced: boolean;
  is_highly_rated: boolean;
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
    this.presentation_audio = output.presentation_audio;
    this.qr_code = output.qr_code;
    this.qr_customization = output.qr_customization;
    this.rating = output.rating;
    this.total_ratings = output.total_ratings;
    this.is_active = output.is_active;
    this.is_verified = output.is_verified;
    this.open_to_gigs = output.open_to_gigs;
    this.accepts_requests_outside_repertoire =
      output.accepts_requests_outside_repertoire;
    this.genres = output.genres;
    this.instruments = output.instruments;
    this.experience_years = output.experience_years;
    this.profile = toPublicMusicianProfile(output.profile);
    this.display_name = output.display_name;
    this.is_experienced = output.is_experienced;
    this.is_highly_rated = output.is_highly_rated;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

/**
 * Um músico como ITEM DE LISTA: o cartão da grade de artistas, do Explorar do
 * fã, da faixa "Em destaque".
 *
 * É o `PublicMusicianPresenter` sem o que nenhuma lista lê (QR, customização
 * do QR, data de criação, `is_experienced`, o interruptor de pedidos) e com o
 * que só uma busca tem: `distance_km`. Medido contra o seed: 1.543 bytes por
 * item antes do enxugamento do perfil, 942 com este cartão.
 *
 * ⚠️ Allowlist, como o presenter público: campo novo no `MusicianOutput` não
 * entra na lista por herança. Se uma tela de lista passar a precisar de um
 * campo, ele é declarado aqui — quem precisa do perfil inteiro chama
 * `GET /musicians/:id`.
 */
export class MusicianCardPresenter {
  id: string;
  name: string;
  stage_name: string | null;
  display_name: string;
  bio: string | null;
  avatar: string | null;
  presentation_audio: MusicianOutput["presentation_audio"];
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  is_highly_rated: boolean;
  open_to_gigs: boolean | null;
  genres: string[];
  instruments: string[];
  experience_years: number;
  profile: PublicMusicianProfile | null;
  /**
   * Km inteiros até a origem que a busca informou (`filter[lat]`/`[lng]`);
   * `null` sem origem ou para músico sem coordenada. Base ou turnê vigente, o
   * que estiver mais perto.
   */
  distance_km: number | null;
  /** O sitemap usa como `lastModified`. */
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: MusicianOutput) {
    this.id = output.id;
    this.name = output.name;
    this.stage_name = output.stage_name;
    this.display_name = output.display_name;
    this.bio = output.bio;
    this.avatar = output.avatar;
    this.presentation_audio = output.presentation_audio;
    this.rating = output.rating;
    this.total_ratings = output.total_ratings;
    this.is_active = output.is_active;
    this.is_verified = output.is_verified;
    this.is_highly_rated = output.is_highly_rated;
    this.open_to_gigs = output.open_to_gigs;
    this.genres = output.genres;
    this.instruments = output.instruments;
    this.experience_years = output.experience_years;
    this.profile = toPublicMusicianProfile(output.profile);
    this.distance_km = output.distance_km ?? null;
    this.updated_at = output.updated_at;
  }
}

/** Nome exibido, foto e o que toca — a resposta de `GET /musicians/identities`. */
export class MusicianIdentityPresenter {
  id: string;
  display_name: string;
  avatar: string | null;
  instruments: string[];
  genres: string[];
  rating: number;
  total_ratings: number;
  is_verified: boolean;

  constructor(output: MusicianIdentityOutput) {
    this.id = output.id;
    this.display_name = output.display_name;
    this.avatar = output.avatar;
    this.instruments = output.instruments;
    this.genres = output.genres;
    this.rating = output.rating;
    this.total_ratings = output.total_ratings;
    this.is_verified = output.is_verified;
  }
}

export class MusicianCollectionPresenter extends CollectionPresenter {
  data: MusicianCardPresenter[];

  constructor(output: ListMusiciansOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new MusicianCardPresenter(i));
  }
}
