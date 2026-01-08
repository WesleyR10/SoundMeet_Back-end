import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Address } from "../../../../shared/domain/value-objects/address.vo";
import { Email } from "../../../../shared/domain/value-objects/email.vo";
import { Phone } from "../../../../shared/domain/value-objects/phone.vo";
import { Rating } from "../../../../shared/domain/value-objects/rating.vo";
import {
  Establishment,
  EstablishmentId,
} from "../../../domain/establishment.aggregate";
import { EstablishmentModel } from "./establishment-model";

export type EstablishmentModelProps = EstablishmentModel;

export class EstablishmentModelMapper {
  static toModel(entity: Establishment): EstablishmentModel {
    return {
      id: entity.establishment_id.id,
      email: entity.email.value,
      name: entity.name,
      description: entity.description,
      avatar: entity.avatar,
      phone: entity.phone?.value ?? null,
      cnpj: entity.cnpj?.value ?? null,
      is_active: entity.is_active,
      isVerified: entity.is_verified,
      created_at: entity.created_at,
      updated_at: entity.created_at,

      // Mapeamento do Endereço (Flattened)
      address_street: entity.address.street,
      address_number: entity.address.number,
      address_complement: entity.address.complement ?? null,
      address_neighborhood: entity.address.neighborhood,
      address_city: entity.address.city,
      address_state: entity.address.state,
      address_zip_code: entity.address.zipCode,
      address_lat: entity.address.latitude ?? null,
      address_long: entity.address.longitude ?? null,
    };
  }

  static toEntity(model: EstablishmentModel): Establishment {
    const address =
      model.address_street &&
      model.address_number &&
      model.address_city &&
      model.address_state &&
      model.address_zip_code &&
      model.address_neighborhood
        ? new Address({
            street: model.address_street,
            number: model.address_number,
            complement: model.address_complement ?? undefined,
            neighborhood: model.address_neighborhood,
            city: model.address_city,
            state: model.address_state,
            zipCode: model.address_zip_code,
            latitude: model.address_lat ?? undefined,
            longitude: model.address_long ?? undefined,
          })
        : null;

    if (!address) {
      // Em um cenário de produção, dados legados sem endereço poderiam causar erro aqui.
      // Como estamos em desenvolvimento/migração, o ideal é garantir que o banco tenha constraints
      // ou tratar como erro de integridade de dados se o domínio exigir Address.
      // Por enquanto, para evitar crash se o banco estiver inconsistente com o domínio:
      throw new LoadEntityError([
        {
          address: [
            `Establishment ${model.id} has invalid/missing address data in database`,
          ],
        },
      ]);
    }

    return new Establishment({
      establishment_id: new EstablishmentId(model.id),
      name: model.name,
      email: new Email(model.email),
      cnpj: model.cnpj, // Passamos a string direta, o construtor converte para VO
      description: model.description,
      avatar: model.avatar,
      phone: model.phone ? new Phone(model.phone) : null,
      website: null,
      address: address,
      establishment_type: "bar", // TODO: Implement type mapping when available in schema
      rating: new Rating(0), // TODO: Implement rating mapping when available in schema
      total_ratings: 0,
      is_active: model.is_active,
      is_verified: model.isVerified,
      created_at: model.created_at,
    });
  }
}
