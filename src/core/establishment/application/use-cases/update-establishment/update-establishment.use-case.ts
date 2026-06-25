import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidOperationError } from "../../../../shared/domain/errors/invalid-operation.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Establishment } from "../../../domain/establishment.aggregate";
import { EstablishmentId } from "../../../domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../domain/establishment.repository";
import {
  EstablishmentOutput,
  EstablishmentOutputMapper,
} from "../common/establishment-output";
import { UpdateEstablishmentInput } from "./update-establishment.input";

export class UpdateEstablishmentUseCase implements IUseCase<
  UpdateEstablishmentInput,
  UpdateEstablishmentOutput
> {
  constructor(
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(
    input: UpdateEstablishmentInput,
  ): Promise<UpdateEstablishmentOutput> {
    const establishmentId = new EstablishmentId(input.id);
    const entity = await this.establishmentRepo.findById(establishmentId);

    if (!entity) {
      throw new NotFoundError(input.id, Establishment);
    }

    if (input.email !== undefined && input.email !== entity.email.value) {
      const existing = await this.establishmentRepo.findByEmail(input.email);
      if (existing && existing.establishment_id.id !== entity.establishment_id.id) {
        throw new EntityValidationError([
          { email: ["Email already in use by another establishment"] },
        ]);
      }
    }

    if (input.cnpj !== undefined) {
      throw new InvalidOperationError("CNPJ cannot be changed after creation");
    }

    input.name !== undefined && entity.changeName(input.name);
    input.description !== undefined &&
      entity.changeDescription(input.description);
    input.avatar !== undefined && entity.changeAvatar(input.avatar);
    input.email !== undefined && entity.changeEmail(input.email);
    input.phone !== undefined && entity.changePhone(input.phone);
    input.website !== undefined && entity.changeWebsite(input.website);
    input.establishment_type !== undefined &&
      entity.changeEstablishmentType(input.establishment_type);

    if (input.is_active === true) {
      entity.activate();
    }
    if (input.is_active === false) {
      entity.deactivate();
    }

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.establishmentRepo.update(entity);
    await this.domainEventMediator?.publish(entity);
    return EstablishmentOutputMapper.toOutput(entity);
  }
}

export type UpdateEstablishmentOutput = EstablishmentOutput;
