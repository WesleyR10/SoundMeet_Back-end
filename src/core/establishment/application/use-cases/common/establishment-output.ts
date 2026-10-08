import { IDateTimeService } from "../../../../shared/domain/date-time.service";
import { Currency } from "../../../../shared/domain/value-objects/money.vo";
import { PriceModel } from "../../../../shared/domain/value-objects/price-range.vo";
import { StageTechSpecJSON } from "../../../../shared/domain/value-objects/stage-tech-spec.vo";
import { Establishment } from "../../../domain/establishment.aggregate";
import { EstablishmentProfile } from "../../../domain/establishment-profile.aggregate";

export type EstablishmentProfileOutput = {
  id: string;
  establishment_id: string;
  capacity: number | null;
  location: Record<string, unknown>;
  amenities: string[];
  preferred_genres: string[];
  operating_hours: Record<string, unknown> | null;
  stage_tech_spec: StageTechSpecJSON | null;
  price_range: {
    model: PriceModel;
    min: number;
    max: number;
    currency: Currency;
    notes: string | null;
  } | null;
  social_links: Record<string, unknown> | null;
  menu_pdfs: Array<{ id: string; url: string; uploaded_at: Date }>;
  created_at: Date;
  updated_at: Date;
};

export type EstablishmentOutput = {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  /**
   * Capa do espaço — só a URL pública.
   *
   * 🔴 `cover_key` fica de FORA do output de propósito. A chave é endereço
   * interno no bucket e `GET /establishments/:id` é `@Public()`; expô-la
   * entregaria o layout do storage a quem não precisa dele, e ninguém no
   * cliente tem o que fazer com ela — quem apaga o objeto é o servidor.
   */
  cover: string | null;
  cnpj: {
    formatted: string | null;
    value: string | null;
  } | null;
  /**
   * Quem assina pela PJ.
   *
   * 🔴 `GET /establishments` e `GET /establishments/:id` são `@Public()`. O
   * CNPJ é registro público e sai inteiro; o CPF do representante é PII de
   * pessoa natural e **nunca** sai completo — só a forma mascarada, que basta
   * para o dono conferir na tela de configurações que o dado certo está
   * gravado. O valor íntegro só é lido dentro do servidor, na emissão do
   * contrato.
   */
  legal_representative: {
    name: string;
    document_masked: string | null;
  } | null;
  email: string;
  phone: string | null;
  website: string | null;
  establishment_type: string;
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  is_open_now: boolean;
  profile: EstablishmentProfileOutput | null;
  created_at: Date;
  updated_at: Date;
  qr_code: string | null;
  is_highly_rated: boolean;
  is_popular: boolean;
  is_bar: boolean;
  is_restaurant: boolean;
  is_club: boolean;
};

export class EstablishmentOutputMapper {
  static toProfileOutput(
    profile: EstablishmentProfile,
  ): EstablishmentProfileOutput {
    return {
      id: profile.profile_id.id,
      establishment_id: profile.establishment_id.id,
      capacity: profile.capacity,
      location: profile.location.toJSON(),
      amenities: profile.amenities,
      preferred_genres: profile.preferredGenres,
      operating_hours: profile.operatingHours?.toJSON() ?? null,
      stage_tech_spec: profile.stageTechSpec?.toJSON() ?? null,
      price_range: profile.priceRange
        ? {
            model: profile.priceRange.model,
            min: profile.priceRange.min,
            max: profile.priceRange.max,
            currency: profile.priceRange.currency,
            notes: profile.priceRange.notes,
          }
        : null,
      social_links: profile.socialLinks?.toJSON() ?? null,
      menu_pdfs: profile.menu_pdfs.map((e) => ({
        id: e.id,
        url: e.url,
        uploaded_at: e.uploaded_at,
      })),
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  }

  static toOutput(
    entity: Establishment,
    dateTimeService?: IDateTimeService,
  ): EstablishmentOutput {
    const now = new Date();
    return {
      id: entity.establishment_id.id,
      name: entity.name,
      description: entity.description,
      avatar: entity.avatar,
      cover: entity.cover,
      cnpj: entity.cnpj
        ? {
            formatted: entity.cnpj.formatted,
            value: entity.cnpj.value,
          }
        : null,
      legal_representative: entity.legal_representative_name
        ? {
            name: entity.legal_representative_name,
            document_masked: EstablishmentOutputMapper.maskCpf(
              entity.legal_representative_document?.value ?? null,
            ),
          }
        : null,
      email: entity.email.value,
      phone: entity.phone?.value ?? null,
      website: entity.website,
      establishment_type: entity.establishment_type,
      rating: entity.rating.value,
      total_ratings: entity.total_ratings,
      is_active: entity.is_active,
      is_verified: entity.is_verified,
      is_open_now:
        entity.profile?.operatingHours?.isOpenAt(now, dateTimeService) ?? false,
      profile: entity.profile ? this.toProfileOutput(entity.profile) : null,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      qr_code: entity.qr_code?.code ?? null,
      is_highly_rated: entity.isHighlyRated,
      is_popular: entity.isPopular,
      is_bar: entity.isBar,
      is_restaurant: entity.isRestaurant,
      is_club: entity.isClub,
    } as EstablishmentOutput;
  }

  /**
   * `"12345678901"` → `"123.***.**9-01"`.
   *
   * Mostra o bastante para o dono reconhecer o próprio documento na tela de
   * configurações e não o bastante para alguém colher CPF de terceiro numa
   * rota pública. Mesmo princípio do `maskName` da verificação de contrato.
   */
  private static maskCpf(value: string | null): string | null {
    if (!value || value.length !== 11) return null;

    return `${value.slice(0, 3)}.***.**${value.slice(8, 9)}-${value.slice(9)}`;
  }
}
