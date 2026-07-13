import { IAudienceRepository } from "../../../../audience/domain/audience.repository";
import { IMusicianRepository } from "../../../../musician/domain/musician.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ExternalServiceError } from "../../../../shared/domain/errors/external-service.error";
import { UnauthorizedError } from "../../../../shared/domain/errors/unauthorized.error";
import {
  IdentityProviderInvalidCredentialsError,
  IIdentityProviderGateway,
} from "../../../infra/gateways/identity-provider-gateway.interface";
import { RegisterRole } from "../register/register.input";
import { LoginInput } from "./login.input";
import { LoginOutput } from "./login.output";

export class LoginUseCase implements IUseCase<LoginInput, LoginOutput> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly audienceRepo: IAudienceRepository,
    private readonly identityGateway: IIdentityProviderGateway,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const tokens = await this.authenticate(input.email, input.password);
    const { role, profileId } = await this.resolveProfile(input.email);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
      role,
      profile_id: profileId,
    };
  }

  private async authenticate(email: string, password: string) {
    try {
      return await this.identityGateway.authenticateWithPassword(
        email,
        password,
      );
    } catch (error) {
      if (error instanceof IdentityProviderInvalidCredentialsError) {
        throw new UnauthorizedError("Credenciais inválidas");
      }
      throw new ExternalServiceError(
        "Não foi possível autenticar no provedor de identidade",
        { cause: error },
      );
    }
  }

  private async resolveProfile(
    email: string,
  ): Promise<{ role: RegisterRole; profileId: string }> {
    const musician = await this.musicianRepo.findByEmail(email);
    if (musician) {
      return { role: "musician", profileId: musician.musician_id.id };
    }

    const audience = await this.audienceRepo.findByEmail(email);
    if (audience) {
      return { role: "audience", profileId: audience.audience_id.id };
    }

    console.error(
      "LoginUseCase: credenciais válidas no provedor de identidade, mas sem aggregate local — estado inconsistente",
      JSON.stringify({ email }),
    );
    throw new UnauthorizedError("Credenciais inválidas");
  }
}
