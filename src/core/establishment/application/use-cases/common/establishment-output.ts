import { Establishment } from "../../../domain/establishment.aggregate";

export type EstablishmentOutput = {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  cnpj: {
    formatted: string | null;
    value: string | null;
  } | null;
  email: string;
  phone: string | null;
  website: string | null;
  address_street: string;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string;
  address_state: string | null;
  address_zipcode: string | null;
  establishment_type: string;
  rating: number;
  total_ratings: number;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
  qr_code: string | null;
  is_highly_rated: boolean;
  is_popular: boolean;
  is_bar: boolean;
  is_restaurant: boolean;
  is_club: boolean;
};

export class EstablishmentOutputMapper {
  static toOutput(entity: Establishment): EstablishmentOutput {
    const { establishment_id, address, cnpj, ...otherProps } = entity.toJSON();

    return {
      id: establishment_id,
      address_street: address.street,
      address_number: address.number,
      address_neighborhood: address.neighborhood,
      address_city: address.city,
      address_state: address.state,
      address_zipcode: address.zipCode,
      cnpj: cnpj
        ? {
            formatted: cnpj.formatted,
            value: cnpj.value,
          }
        : null,
      ...otherProps,
    } as EstablishmentOutput;
  }
}
