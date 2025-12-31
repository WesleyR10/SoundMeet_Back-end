import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Establishment } from "../../../domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../domain/establishment.repository";
import {
  EstablishmentOutput,
  EstablishmentOutputMapper,
} from "../common/establishment-output";
import { CreateEstablishmentInput } from "./create-establishment.input";

export class CreateEstablishmentUseCase implements IUseCase<
  CreateEstablishmentInput,
  CreateEstablishmentOutput
> {
  constructor(private readonly establishmentRepo: IEstablishmentRepository) {}

  async execute(
    input: CreateEstablishmentInput,
  ): Promise<CreateEstablishmentOutput> {
    const entity = Establishment.create({
      name: input.name,
      description: input.description,
      avatar: input.avatar,
      cnpj: input.cnpj,
      email: input.email,
      phone: input.phone,
      website: input.website,
      address: {
        street: input.address_street,
        number: input.address_number,
        city: input.address_city,
        state: input.address_state,
        zipCode: input.address_zipcode,
        neighborhood: input.address_neighborhood,
      },
      establishment_type: input.establishment_type,
      is_active: input.is_active,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.establishmentRepo.insert(entity);
    return EstablishmentOutputMapper.toOutput(entity);
  }
}

export type CreateEstablishmentOutput = EstablishmentOutput;
