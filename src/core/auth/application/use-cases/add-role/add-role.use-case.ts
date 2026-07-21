import {
  Audience,
  AudienceId,
} from "../../../../audience/domain/audience.aggregate";
import { IAudienceRepository } from "../../../../audience/domain/audience.repository";
import {
  Musician,
  MusicianId,
} from "../../../../musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../../musician/domain/musician.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ConflictError } from "../../../../shared/domain/errors/conflict.error";
import { ExternalServiceError } from "../../../../shared/domain/errors/external-service.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { CPF } from "../../../../shared/domain/value-objects/cpf.vo";
import { Phone } from "../../../../shared/domain/value-objects/phone.vo";
import {
  IdentityUser,
  IIdentityProviderGateway,
} from "../../../infra/gateways/identity-provider-gateway.interface";
import { AddRoleInput, AddRoleRole } from "./add-role.input";
import { AddRoleOutput } from "./add-role.output";

// Multi-role (mobile 10.5.2/10.5.3): usuário JÁ cadastrado com um papel
// (músico ou fã) adiciona o outro — atribui a role no Keycloak e cria o
// aggregate que falta com o MESMO id do token (sub). Complemento do
// SocialSignupUseCase, que atende quem ainda não tem papel nenhum.
// Após o 201, o app faz token refresh silencioso pra role nova entrar no
// JWT (10.5.4).
export class AddRoleUseCase implements IUseCase<AddRoleInput, AddRoleOutput> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly audienceRepo: IAudienceRepository,
    private readonly identityGateway: IIdentityProviderGateway,
  ) {}

  async execute(input: AddRoleInput): Promise<AddRoleOutput> {
    this.assertHasInitialSignup(input.existing_roles);
    this.assertRoleNotOwned(input.existing_roles, input.role);

    if (input.role === "musician") {
      await this.assertCpfNotTaken(input.cpf);
      await this.assertPhoneNotTaken(input.phone);
    }

    // Defensivo: role perdida no Keycloak mas aggregate já existente (estado
    // órfão de uma falha anterior) — só reatribui a role, sem duplicar perfil.
    const existingProfileId = await this.findExistingProfileId(input);
    if (existingProfileId) {
      await this.assignRole(input.user_id, input.role);
      return { role: input.role, profile_id: existingProfileId };
    }

    const identityUser = await this.getIdentityUser(input.user_id);

    await this.assignRole(input.user_id, input.role);

    const profileId = await this.createProfile(input, identityUser);

    return { role: input.role, profile_id: profileId };
  }

  private assertHasInitialSignup(existingRoles: string[]): void {
    const hasProfileRole = existingRoles.some(
      (role) => role === "musician" || role === "audience",
    );
    if (!hasProfileRole) {
      throw new ConflictError(
        "Usuário ainda não completou o cadastro inicial",
      );
    }
  }

  private assertRoleNotOwned(
    existingRoles: string[],
    role: AddRoleRole,
  ): void {
    if (existingRoles.includes(role)) {
      throw new ConflictError("Usuário já possui este papel");
    }
  }

  private async assertCpfNotTaken(cpf?: string): Promise<void> {
    if (!cpf) return;
    let normalized: string;
    try {
      normalized = new CPF(cpf).value;
    } catch {
      return;
    }
    const existing = await this.musicianRepo.findByCpf(normalized);
    if (existing) {
      throw new ConflictError("CPF já cadastrado");
    }
  }

  private async assertPhoneNotTaken(phone?: string): Promise<void> {
    if (!phone) return;
    const phoneOrError = Phone.create(phone);
    if (phoneOrError.isFail()) return;
    const existing = await this.musicianRepo.findByPhone(
      phoneOrError.ok.value,
    );
    if (existing) {
      throw new ConflictError("Celular já cadastrado");
    }
  }

  private async findExistingProfileId(
    input: AddRoleInput,
  ): Promise<string | null> {
    if (input.role === "musician") {
      const musician = await this.musicianRepo.findById(
        new MusicianId(input.user_id),
      );
      return musician ? musician.musician_id.id : null;
    }
    const audience = await this.audienceRepo.findById(
      new AudienceId(input.user_id),
    );
    return audience ? audience.audience_id.id : null;
  }

  private async getIdentityUser(userId: string): Promise<IdentityUser> {
    try {
      return await this.identityGateway.getUser(userId);
    } catch (error) {
      throw new ExternalServiceError(
        "Não foi possível obter os dados do usuário no provedor de identidade",
        { cause: error },
      );
    }
  }

  private async assignRole(userId: string, role: AddRoleRole): Promise<void> {
    try {
      await this.identityGateway.assignRealmRole(userId, role);
    } catch (error) {
      throw new ExternalServiceError(
        "Não foi possível atribuir o papel do usuário no provedor de identidade",
        { cause: error },
      );
    }
  }

  private async createProfile(
    input: AddRoleInput,
    identityUser: IdentityUser,
  ): Promise<string> {
    try {
      if (input.role === "musician") {
        const musician = Musician.create({
          musician_id: new MusicianId(input.user_id),
          email: identityUser.email,
          name: identityUser.name,
          cpf: input.cpf ?? null,
          phone: input.phone ?? null,
          genres: [],
          instruments: [],
          is_active: true,
        });

        if (musician.notification.hasErrors()) {
          throw new EntityValidationError(musician.notification.toJSON());
        }

        await this.musicianRepo.insert(musician);
        return musician.musician_id.id;
      }

      const audience = Audience.create({
        audience_id: new AudienceId(input.user_id),
        email: identityUser.email,
        name: identityUser.name,
        is_active: true,
      });

      if (audience.notification.hasErrors()) {
        throw new EntityValidationError(audience.notification.toJSON());
      }

      await this.audienceRepo.insert(audience);
      return audience.audience_id.id;
    } catch (error) {
      // A conta Keycloak é do usuário (já cadastrado) — a compensação remove
      // só a role recém-atribuída, nunca deleta a conta.
      await this.compensate(input.user_id, input.role);
      throw error;
    }
  }

  private async compensate(userId: string, role: AddRoleRole): Promise<void> {
    try {
      await this.identityGateway.removeRealmRole(userId, role);
    } catch (error) {
      console.error(
        "AddRoleUseCase: falha ao compensar (rollback) role no provedor de identidade — estado órfão manual",
        JSON.stringify({
          user_id: userId,
          role,
          error: this.describeError(error),
        }),
      );
    }
  }

  private describeError(error: unknown): unknown {
    if (error instanceof Error) {
      return { name: error.name, message: error.message };
    }
    return error;
  }
}
