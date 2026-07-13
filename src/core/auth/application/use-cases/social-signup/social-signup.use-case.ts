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
import { SocialSignupInput, SocialSignupRole } from "./social-signup.input";
import { SocialSignupOutput } from "./social-signup.output";

export class SocialSignupUseCase implements IUseCase<
  SocialSignupInput,
  SocialSignupOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly audienceRepo: IAudienceRepository,
    private readonly identityGateway: IIdentityProviderGateway,
  ) {}

  async execute(input: SocialSignupInput): Promise<SocialSignupOutput> {
    this.assertNotAlreadySignedUp(input.existing_roles);

    if (input.role === "musician") {
      await this.assertCpfNotTaken(input.cpf);
      await this.assertPhoneNotTaken(input.phone);
    }

    const identityUser = await this.getIdentityUser(input.user_id);

    await this.assignRole(input.user_id, input.role);

    const profileId = await this.createProfile(input, identityUser);

    return { role: input.role, profile_id: profileId };
  }

  private assertNotAlreadySignedUp(existingRoles: string[]): void {
    const hasProfileRole = existingRoles.some(
      (role) => role === "musician" || role === "audience",
    );
    if (hasProfileRole) {
      throw new ConflictError("Usuário já cadastrado");
    }
  }

  private async assertCpfNotTaken(cpf?: string): Promise<void> {
    if (!cpf) return;
    // Formato inválido é reportado depois pela validação do agregado (422);
    // aqui só nos importa checar duplicidade do valor normalizado.
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

  private async assignRole(
    userId: string,
    role: SocialSignupRole,
  ): Promise<void> {
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
    input: SocialSignupInput,
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
      // O usuário Keycloak não é nosso (autenticou via Google), então a
      // compensação aqui remove só a role atribuída — nunca deleta a conta.
      await this.compensate(input.user_id, input.role);
      throw error;
    }
  }

  private async compensate(
    userId: string,
    role: SocialSignupRole,
  ): Promise<void> {
    try {
      await this.identityGateway.removeRealmRole(userId, role);
    } catch (error) {
      console.error(
        "SocialSignupUseCase: falha ao compensar (rollback) role no provedor de identidade — estado órfão manual",
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
