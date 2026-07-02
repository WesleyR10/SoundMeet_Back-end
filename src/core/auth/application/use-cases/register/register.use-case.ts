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
import { IEmailVerificationIssuer } from "../../../infra/gateways/email-verification-issuer.interface";
import {
  IdentityProviderConflictError,
  IIdentityProviderGateway,
} from "../../../infra/gateways/identity-provider-gateway.interface";
import { RegisterInput, RegisterRole } from "./register.input";
import { RegisterOutput } from "./register.output";

export class RegisterUseCase implements IUseCase<
  RegisterInput,
  RegisterOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly audienceRepo: IAudienceRepository,
    private readonly identityGateway: IIdentityProviderGateway,
    private readonly emailVerificationIssuer: IEmailVerificationIssuer,
  ) {}

  async execute(input: RegisterInput): Promise<RegisterOutput> {
    await this.assertEmailNotTaken(input.email, input.role);

    const externalId = await this.createIdentityUser(input);

    await this.assignRole(externalId, input.role);

    const profileId = await this.createProfile(input, externalId);

    await this.issueEmailVerification(input.role, profileId);

    return this.authenticate(input, externalId, profileId);
  }

  private async assertEmailNotTaken(
    email: string,
    role: RegisterRole,
  ): Promise<void> {
    const existing =
      role === "musician"
        ? await this.musicianRepo.findByEmail(email)
        : await this.audienceRepo.findByEmail(email);

    if (existing) {
      throw new ConflictError("Email já cadastrado");
    }
  }

  private async createIdentityUser(input: RegisterInput): Promise<string> {
    try {
      const created = await this.identityGateway.createUser({
        email: input.email,
        name: input.name,
        password: input.password,
      });
      return created.external_id;
    } catch (error) {
      if (error instanceof IdentityProviderConflictError) {
        throw new ConflictError("Email já cadastrado");
      }
      throw new ExternalServiceError(
        "Não foi possível criar a conta no provedor de identidade",
        { cause: error },
      );
    }
  }

  private async assignRole(
    externalId: string,
    role: RegisterRole,
  ): Promise<void> {
    try {
      await this.identityGateway.assignRealmRole(externalId, role);
    } catch (error) {
      await this.compensate(externalId);
      throw new ExternalServiceError(
        "Não foi possível atribuir o papel do usuário no provedor de identidade",
        { cause: error },
      );
    }
  }

  private async createProfile(
    input: RegisterInput,
    externalId: string,
  ): Promise<string> {
    try {
      if (input.role === "musician") {
        const musician = Musician.create({
          musician_id: new MusicianId(externalId),
          email: input.email,
          name: input.name,
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
        audience_id: new AudienceId(externalId),
        email: input.email,
        name: input.name,
        is_active: true,
      });

      if (audience.notification.hasErrors()) {
        throw new EntityValidationError(audience.notification.toJSON());
      }

      await this.audienceRepo.insert(audience);
      return audience.audience_id.id;
    } catch (error) {
      await this.compensate(externalId);
      throw error;
    }
  }

  private async issueEmailVerification(
    role: RegisterRole,
    profileId: string,
  ): Promise<void> {
    try {
      await this.emailVerificationIssuer.issueVerificationToken(
        role,
        profileId,
      );
    } catch (error) {
      // Best-effort: a conta já é válida e o login não deve ser bloqueado por isso.
      console.warn(
        "RegisterUseCase: falha ao emitir token de verificação de email (não bloqueante)",
        JSON.stringify({
          role,
          profile_id: profileId,
          error: this.describeError(error),
        }),
      );
    }
  }

  private async authenticate(
    input: RegisterInput,
    externalId: string,
    profileId: string,
  ): Promise<RegisterOutput> {
    try {
      const tokens = await this.identityGateway.authenticateWithPassword(
        input.email,
        input.password,
      );

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
        role: input.role,
        profile_id: profileId,
      };
    } catch (error) {
      // A conta e o perfil já foram commitados com sucesso — não compensar aqui.
      throw new ExternalServiceError(
        "Conta criada com sucesso, mas não foi possível autenticar automaticamente. Tente fazer login.",
        {
          cause: error,
          metadata: { profile_id: profileId, external_id: externalId },
        },
      );
    }
  }

  private async compensate(externalId: string): Promise<void> {
    try {
      await this.identityGateway.deleteUser(externalId);
    } catch (error) {
      console.error(
        "RegisterUseCase: falha ao compensar (rollback) usuário no provedor de identidade — estado órfão manual",
        JSON.stringify({
          external_id: externalId,
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
