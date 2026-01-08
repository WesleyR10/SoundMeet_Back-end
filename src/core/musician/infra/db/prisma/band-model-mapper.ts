import { Currency } from "../../../../shared/domain/value-objects/money.vo";
import {
  PriceModel,
  PriceRange,
} from "../../../../shared/domain/value-objects/price-range.vo";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Band, BandId } from "../../../domain/band.aggregate";
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
      price_model: entity.priceRange?.model ?? null,
      price_min: entity.priceRange?.min ?? null,
      price_max: entity.priceRange?.max ?? null,
      price_currency: entity.priceRange
        ? toDbCurrency(entity.priceRange.currency)
        : null,
      price_notes: entity.priceRange?.notes ?? null,
      is_active: entity.is_active,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: BandModel): Band {
    const priceRange =
      model.price_model && model.price_min !== null && model.price_max !== null
        ? new PriceRange({
            model: model.price_model as PriceModel,
            min: model.price_min,
            max: model.price_max,
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
      members: (model.members ?? []).map((m) => ({
        member_id: new Uuid(m.id),
        musician_id: new Uuid(m.musicianId),
        role: m.role,
        instrument: m.instrument,
        joined_at: m.joinedAt,
      })),
      priceRange: priceRange,
      is_active: model.is_active,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });
  }
}
