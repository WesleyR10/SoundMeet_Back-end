import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IIdentityClaimsWriter } from "../../../../shared/application/identity-claims.interface";
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
    private readonly identityClaims?: IIdentityClaimsWriter,
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

    // Vincular ANTES de persistir é intencional. Estabelecimento tem UUID
    // próprio (≠ `sub`), e é o claim `establishment_ids` que autoriza o dono a
    // operá-lo. Se o Keycloak falhar, nada é criado e o erro aparece; se fosse
    // depois do insert, sobraria um estabelecimento que o dono não consegue
    // acessar. A ordem inversa deixa no máximo um claim órfão — inofensivo,
    // porque o use case seguinte responde 404 para id inexistente.
    if (input.owner_user_id && this.identityClaims) {
      await this.identityClaims.addClaimValue(
        input.owner_user_id,
        "establishment_ids",
        entity.establishment_id.id,
      );
    }

    await this.establishmentRepo.insert(entity);
    return EstablishmentOutputMapper.toOutput(entity);
  }
}

export type CreateEstablishmentOutput = EstablishmentOutput;
