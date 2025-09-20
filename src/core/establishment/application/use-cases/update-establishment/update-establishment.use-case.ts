import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Establishment } from "../../../domain/establishment.aggregate";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { EstablishmentId } from "../../../domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../domain/establishment.repository";
import {
  EstablishmentOutput,
  EstablishmentOutputMapper,
} from "../common/establishment-output";
import { UpdateEstablishmentInput } from "./update-establishment.input";

export class UpdateEstablishmentUseCase
  implements IUseCase<UpdateEstablishmentInput, UpdateEstablishmentOutput>
{
  constructor(private readonly establishmentRepo: IEstablishmentRepository) {}

  async execute(
    input: UpdateEstablishmentInput,
  ): Promise<UpdateEstablishmentOutput> {
    const establishmentId = new EstablishmentId(input.id);
    const entity = await this.establishmentRepo.findById(establishmentId);

    if (!entity) {
      throw new NotFoundError(input.id, Establishment);
    }

    input.name !== undefined && entity.changeName(input.name);
    input.description !== undefined &&
      entity.changeDescription(input.description);
    input.avatar !== undefined && entity.changeAvatar(input.avatar);
    // CNPJ cannot be changed after creation
    input.email !== undefined && entity.changeEmail(input.email);
    input.phone !== undefined && entity.changePhone(input.phone);
    input.website !== undefined && entity.changeWebsite(input.website);
    // Update address if any address field is provided
    if (
      input.address_street !== undefined ||
      input.address_number !== undefined ||
      input.address_city !== undefined ||
      input.address_state !== undefined ||
      input.address_zipcode !== undefined ||
      input.address_neighborhood !== undefined
    ) {
      const currentAddress = entity.address;
      entity.changeAddress(
        input.address_street ?? currentAddress.street,
        input.address_number ?? currentAddress.number,
        input.address_city ?? currentAddress.city,
        input.address_state ?? currentAddress.state,
        input.address_zipcode ?? currentAddress.zipCode,
        input.address_neighborhood ?? currentAddress.neighborhood,
      );
    }
    input.establishment_type !== undefined &&
      entity.changeEstablishmentType(input.establishment_type);

    if (input.is_active === true) {
      entity.activate();
    }
    if (input.is_active === false) {
      entity.deactivate();
    }

    if (input.is_verified === true) {
      entity.verify();
    }
    if (input.is_verified === false) {
      entity.unverify();
    }

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.establishmentRepo.update(entity);
    return EstablishmentOutputMapper.toOutput(entity);
  }
}

export type UpdateEstablishmentOutput = EstablishmentOutput;
