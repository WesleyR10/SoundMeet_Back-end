import { Location } from "../../../../shared/domain/value-objects/location.vo";
import { Currency } from "../../../../shared/domain/value-objects/money.vo";
import {
  PriceModel,
  PriceRange,
} from "../../../../shared/domain/value-objects/price-range.vo";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Band, BandId } from "../../../domain/band.aggregate";
import { parseBandMemberRole } from "../../../domain/band-member-role";
import { BandModel, CurrencyDb } from "./band-model";

const toDbCurrency = (currency: Currency): CurrencyDb => {
  switch (currency) {
    case Currency.BRL:
      return "BRL";
    case Currency.USD:
      return "USD";
    case Currency.EUR:
      return "EUR";
  }
};

const toDomainCurrency = (currency: CurrencyDb): Currency => {
  switch (currency) {
    case "BRL":
      return Currency.BRL;
    case "USD":
      return Currency.USD;
    case "EUR":
      return Currency.EUR;
  }
};

export class BandModelMapper {
  static toModel(entity: Band): Omit<BandModel, "members"> {
    return {
      id: entity.band_id.id,
      name: entity.name,
      description: entity.description ?? null,
      avatar: entity.avatar ?? null,
      genres: entity.genres,
      formed_in: entity.formed_in ?? null,
      qr_code: entity.qr_code ?? null,
      price_model: entity.priceRange?.model ?? null,
      price_min: entity.priceRange?.min ?? null,
      price_max: entity.priceRange?.max ?? null,
      price_currency: entity.priceRange
        ? toDbCurrency(entity.priceRange.currency)
        : null,
      price_notes: entity.priceRange?.notes ?? null,
      open_to_gigs: entity.open_to_gigs,
      address: entity.address
        ? (entity.address.toJSON() as unknown as BandModel["address"])
        : null,
      location_lat: entity.address?.latitude ?? null,
      location_lng: entity.address?.longitude ?? null,
      is_active: entity.is_active,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: BandModel): Band {
    // 🔴 `Number(...)`, e não o valor cru. As colunas são `Decimal(12,2)` e o
    // Prisma as devolve como objeto `Decimal`, não como número — o `PriceRange`
    // exige `Number.isFinite` e lançava "Minimum price must be a finite
    // number". Efeito: uma banda com faixa de preço gravada NUNCA mais
    // carregava, e a busca pública respondia 422 inteira se uma única banda da
    // página tivesse preço. Não aparecia porque nenhuma banda tinha preço (o
    // app ainda não tem a tela) e o repositório em memória guarda o número
    // como número. Mesma conversão do mapper de músico.
    const priceRange =
      model.price_model && model.price_min !== null && model.price_max !== null
        ? new PriceRange({
            model: model.price_model as PriceModel,
            min: Number(model.price_min),
            max: Number(model.price_max),
            currency: model.price_currency
              ? toDomainCurrency(model.price_currency)
              : undefined,
            notes: model.price_notes,
          })
        : null;

    return new Band({
      band_id: new BandId(model.id),
      name: model.name,
      description: model.description ?? undefined,
      avatar: model.avatar ?? undefined,
      genres: model.genres,
      formed_in: model.formed_in ?? null,
      qr_code: model.qr_code ?? null,
      members: (model.members ?? []).map((m) => ({
        member_id: new Uuid(m.id),
        musician_id: new Uuid(m.musicianId),
        // Enum no banco desde a migration do papel de membro; o parse cobre
        // linhas anteriores a ela e devolve "member" no que não reconhecer.
        role: parseBandMemberRole(m.role) ?? "member",
        instrument: m.instrument,
        status: m.status,
        joined_at: m.joinedAt,
        responded_at: m.responded_at,
      })),
      priceRange: priceRange,
      address: model.address ? Location.fromJSON(model.address) : null,
      open_to_gigs: model.open_to_gigs,
      is_active: model.is_active,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
