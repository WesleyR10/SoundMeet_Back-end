import {
  Establishment,
  EstablishmentId,
} from "../../../domain/establishment.aggregate";
import { Email } from "../../../../shared/domain/value-objects/email.vo";
import { Phone } from "../../../../shared/domain/value-objects/phone.vo";
import { Rating } from "../../../../shared/domain/value-objects/rating.vo";
import { Address } from "../../../../shared/domain/value-objects/address.vo";
import { EstablishmentModel } from "./establishment-model";

export type EstablishmentModelProps = EstablishmentModel;

export class EstablishmentModelMapper {
  static toModel(entity: Establishment): EstablishmentModel {
    return {
      id: entity.id.id,
      email: entity.email.value,
      name: entity.name,
      description: entity.description,
      avatar: entity.avatar,
      cnpj: entity.cnpj?.value ?? null,
      phone: entity.phone?.value ?? null,
      isActive: entity.is_active,
      isVerified: entity.is_verified,
      created_at: entity.created_at,
      updated_at: entity.created_at, // Usando created_at como fallback já que updated_at não existe
    };
  }

  static toEntity(model: EstablishmentModel): Establishment {
    const address = new Address({
      street: "Rua Exemplo",
      number: "123",
      complement: undefined,
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      zipCode: "01000-000",
      country: "Brasil",
    });

    return new Establishment({
      id: new EstablishmentId(model.id),
      name: model.name,
      email: new Email(model.email),
      cnpj: model.cnpj,
      description: model.description,
      avatar: model.avatar,
      phone: model.phone ? new Phone(model.phone) : null,
      website: null,
      address,
      establishment_type: "bar",
      rating: new Rating(0),
      total_ratings: 0,
      is_active: model.isActive,
      is_verified: model.isVerified,
      created_at: model.created_at,
    });
  }
}
