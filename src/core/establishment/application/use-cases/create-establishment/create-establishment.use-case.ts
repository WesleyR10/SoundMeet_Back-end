import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Establishment } from "../../../domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../domain/establishment.repository";
import {
  EstablishmentOutput,
  EstablishmentOutputMapper,
} from "../common/establishment-output";
import { CreateEstablishmentInput } from "./create-establishment.input";

const MAX_ESTABLISHMENTS_PER_ACCOUNT = 3;

export class CreateEstablishmentUseCase implements IUseCase<
  CreateEstablishmentInput,
  CreateEstablishmentOutput
> {
  constructor(
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly planCheckService?: PlanCheckService,
  ) {}

  async execute(
    input: CreateEstablishmentInput,
  ): Promise<CreateEstablishmentOutput> {
    const existingIds = input.existing_establishment_ids ?? [];

    if (existingIds.length >= MAX_ESTABLISHMENTS_PER_ACCOUNT) {
      throw new EntityValidationError([
        { base: ["Limite de 3 estabelecimentos por conta atingido"] },
      ]);
    }

    if (existingIds.length >= 1 && this.planCheckService) {
      await this.planCheckService.assertEstablishmentFeature(
        existingIds[0],
        "multi_establishment",
      );
    }

    const existing = await this.establishmentRepo.findByEmail(input.email);
    if (existing) {
      throw new EntityValidationError([
        { email: ["Email already in use by another establishment"] },
      ]);
    }

    const entity = Establishment.create({
      name: input.name,
      description: input.description,
      avatar: input.avatar,
      cnpj: input.cnpj,
      email: input.email,
      phone: input.phone,
      website: input.website,
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
