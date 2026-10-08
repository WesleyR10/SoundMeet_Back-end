import { AggregateRoot, Uuid } from "../../shared/domain";
import { Location } from "../../shared/domain/value-objects/location.vo";
import { PriceRange } from "../../shared/domain/value-objects/price-range.vo";
import { MusicianProfileValidatorFactory } from "./musician-profile.validator";
import { MusicianProfileFakeBuilder } from "./musician-profile-fake.builder";

export type MusicianProfileSocialLinks = Record<string, unknown>;

export type MusicianProfileConstructorProps = {
  profile_id?: MusicianProfileId;
  musician_id: Uuid;
  priceRanges?: PriceRange[];
  location?: Location;
  // Modo turnê (7.13d) — segundo ponto de busca, opcional e com expiração
  // automática, somado à base permanente (nunca a substitui).
  touring_location?: Location | null;
  touring_expires_at?: Date | null;
  socialLinks?: MusicianProfileSocialLinks | null;
  created_at?: Date;
  updated_at?: Date;
};

export type MusicianProfileCreateCommand = {
  profile_id?: MusicianProfileId;
  musician_id: Uuid;
  priceRanges?: PriceRange[];
  location?: Location;
  socialLinks?: MusicianProfileSocialLinks | null;
};

// Duração máxima de uma ativação do modo turnê (7.13d) — evita virar uma
// segunda base permanente disfarçada (sem teto, o músico poderia nunca
// deixar expirar).
export const MAX_TOURING_DAYS = 30;

export class MusicianProfileId extends Uuid {}

/**
 * O lado COMERCIAL do músico: quanto cobra, de onde é, por onde está passando
 * e as redes. Persistido em `musician_profiles`.
 *
 * 🔴 Gêneros, instrumentos e anos de estrada NÃO moram aqui (out/2026).
 * Existiam duplicados neste agregado, mas `musician_profiles` nunca teve
 * coluna para eles: na carga eram copiados de `musicians`, e na escrita só os
 * do `Musician` chegavam ao banco. Duas cópias em memória de um dado com uma
 * coluna só — o doc de arquitetura proíbe ("duplicar fonte de verdade entre
 * agregados") e a consequência foi concreta: `PATCH .../profile` com
 * `experience` alterava a cópia daqui, respondia 200 com o valor novo e não
 * gravava nada. A fonte é única: `Musician.genres`, `Musician.instruments` e
 * `Musician.experience_years`.
 */
export class MusicianProfile extends AggregateRoot {
  profile_id: MusicianProfileId;
  musician_id: Uuid;
  // Uma faixa por modelo de cobrança (per_hour e/ou per_event) — o músico
  // pode precificar os dois ao mesmo tempo, com min/max independentes.
  priceRanges: PriceRange[];
  location: Location;
  touring_location: Location | null;
  touring_expires_at: Date | null;
  socialLinks: MusicianProfileSocialLinks | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: MusicianProfileConstructorProps) {
    super();
    this.profile_id = props.profile_id ?? new MusicianProfileId();
    this.musician_id = props.musician_id;
    this.priceRanges = props.priceRanges ?? [];
    this.location = props.location ?? new Location({});
    this.touring_location = props.touring_location ?? null;
    this.touring_expires_at = props.touring_expires_at ?? null;
    this.socialLinks = props.socialLinks ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): Uuid {
    return this.profile_id;
  }

  static create(command: MusicianProfileCreateCommand): MusicianProfile {
    const profile = new MusicianProfile(command);
    profile.validate();
    return profile;
  }

  validate(fields?: string[]) {
    const validator = MusicianProfileValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  changePriceRanges(priceRanges: PriceRange[]) {
    const models = priceRanges.map((range) => range.model);
    if (new Set(models).size !== models.length) {
      this.notification.addError(
        "Price ranges must have unique models (at most one per_hour and one per_event)",
        "priceRanges",
      );
      return;
    }
    this.priceRanges = priceRanges;
    this.updated_at = new Date();
  }

  changeLocation(location: Location) {
    this.location = location;
    this.updated_at = new Date();
  }

  // Modo turnê (7.13d): segundo ponto de busca, somado à base permanente
  // (nunca a substitui). Expiração é computada em leitura (ver isTouring) —
  // sem cron, mesmo padrão de Subscription.isActive().
  setTouringLocation(
    location: Location,
    expires_at: Date,
    now: Date = new Date(),
  ) {
    if (!location.hasCoordinates) {
      this.notification.addError(
        "Touring location must include coordinates",
        "touring_location",
      );
      return;
    }
    if (expires_at.getTime() <= now.getTime()) {
      this.notification.addError(
        "touring_expires_at must be in the future",
        "touring_expires_at",
      );
      return;
    }
    const maxExpiry = new Date(
      now.getTime() + MAX_TOURING_DAYS * 24 * 60 * 60 * 1000,
    );
    if (expires_at.getTime() > maxExpiry.getTime()) {
      this.notification.addError(
        `touring_expires_at cannot exceed ${MAX_TOURING_DAYS} days from now`,
        "touring_expires_at",
      );
      return;
    }
    this.touring_location = location;
    this.touring_expires_at = expires_at;
    this.updated_at = now;
  }

  clearTouringLocation(now: Date = new Date()) {
    this.touring_location = null;
    this.touring_expires_at = null;
    this.updated_at = now;
  }

  get isTouring(): boolean {
    return (
      this.touring_location !== null &&
      this.touring_expires_at !== null &&
      this.touring_expires_at.getTime() > Date.now()
    );
  }

  changeSocialLinks(socialLinks: MusicianProfileSocialLinks | null) {
    this.socialLinks = socialLinks;
    this.updated_at = new Date();
  }

  toJSON() {
    return {
      profile_id: this.profile_id.id,
      musician_id: this.musician_id.id,
      priceRanges: this.priceRanges.map((range) => range.toJSON()),
      location: this.location.toJSON(),
      touring_location: this.touring_location?.toJSON() ?? null,
      touring_expires_at: this.touring_expires_at,
      socialLinks: this.socialLinks,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  static fake() {
    return MusicianProfileFakeBuilder;
  }
}
