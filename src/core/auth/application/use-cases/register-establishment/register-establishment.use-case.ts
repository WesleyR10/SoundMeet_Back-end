import { Establishment } from "../../../../establishment/domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../../establishment/domain/establishment.repository";
import { IIdentityClaimsWriter } from "../../../../shared/application/identity-claims.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ConflictError } from "../../../../shared/domain/errors/conflict.error";
import { ExternalServiceError } from "../../../../shared/domain/errors/external-service.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { CNPJ } from "../../../../shared/domain/value-objects/cnpj.vo";
import { IEmailVerificationIssuer } from "../../../infra/gateways/email-verification-issuer.interface";
import {
  IdentityProviderConflictError,
  IIdentityProviderGateway,
} from "../../../infra/gateways/identity-provider-gateway.interface";
import { RegisterEstablishmentInput } from "./register-establishment.input";
import { RegisterEstablishmentOutput } from "./register-establishment.output";

/**
 * Porta de entrada de contas de estabelecimento (Bloco 9.1).
 *
 * Antes disto **não existia caminho nenhum** para criar a primeira conta de
 * estabelecimento: `RegisterUseCase` só aceita `musician`/`audience`, e
 * `POST /establishments` é `@Roles("establishment")` — era preciso já ter a
 * role para criar o estabelecimento que daria direito a ela.
 *
 * ⚠️ **A invariante `aggregate.id === sub` NÃO vale aqui.** Para músico e
 * público o id do agregado É o `sub` do Keycloak, e os guards comparam os dois
 * diretamente. Estabelecimento não: uma conta pode operar até 3 unidades, e o
 * vínculo mora no claim multivalorado `establishment_ids`, escrito via
 * `IIdentityClaimsWriter`. Copiar o `RegisterUseCase` e trocar o tipo do
 * agregado quebraria o modelo de ownership inteiro.
 *
 * Este use case é irmão do `RegisterUseCase`, não uma variação dele — mesma
 * sequência (checagens locais → provedor de identidade → agregado →
 * verificação de e-mail → autenticação) e mesma política de compensação.
 */
export class RegisterEstablishmentUseCase implements IUseCase<
  RegisterEstablishmentInput,
  RegisterEstablishmentOutput
> {
  constructor(
    private readonly establishmentRepo: IEstablishmentRepository,
    private readonly identityGateway: IIdentityProviderGateway,
    private readonly identityClaims: IIdentityClaimsWriter,
    private readonly emailVerificationIssuer: IEmailVerificationIssuer,
  ) {}

  async execute(
    input: RegisterEstablishmentInput,
  ): Promise<RegisterEstablishmentOutput> {
    // Duplicidade é checada ANTES de tocar o provedor de identidade: um 409 de
    // e-mail/CNPJ não deve deixar usuário órfão no Keycloak nem depender de
    // compensação. Mesmo precedente do CPF/celular no RegisterUseCase.
    await this.assertEmailNotTaken(input.email);
    await this.assertCnpjNotTaken(input.cnpj);

    const externalId = await this.createIdentityUser(input);

    await this.assignRole(externalId);

    const establishmentId = await this.createEstablishment(input, externalId);

    await this.issueEmailVerification(establishmentId);

    /*
     * 🔴 AUTH-1: o cadastro NÃO emite mais tokens.
     *
     * Antes daqui saía um Direct Access Grant no client `soundmeet-mobile`, e o
     * `soundmeet-web` — único chamador desta rota — **descartava o par de
     * tokens** e mandava o usuário pelo Authorization Code + PKCE
     * (`register-establishment/route.ts` → `/api/auth/login` com `login_hint`).
     * Ele descartava por dois motivos corretos: refresh token é vinculado ao
     * client que o emitiu, e o token nascia SEM o claim `establishment_ids`,
     * escrito depois da emissão — daí o antigo `needs_token_refresh: true`.
     *
     * Ou seja: gastávamos um grant de senha para produzir credencial que
     * ninguém usava e que já nascia incompleta. Remover fecha o grant e apaga a
     * armadilha junto.
     */
    return { establishment_id: establishmentId };
  }

  private async assertEmailNotTaken(email: string): Promise<void> {
    const existing = await this.establishmentRepo.findByEmail(email);
    if (existing) {
      throw new ConflictError("Email já cadastrado");
    }
  }

  private async assertCnpjNotTaken(cnpj?: string): Promise<void> {
    if (!cnpj) return;

    // Formato inválido não é tratado aqui: quem reporta é a validação do
    // agregado (422, com o campo certo). Aqui só interessa duplicidade do
    // valor normalizado — mesmo desenho de `assertCpfNotTaken`.
    let normalized: string;
    try {
      normalized = new CNPJ(cnpj).value;
    } catch {
      return;
    }

    const existing = await this.establishmentRepo.findByCnpj(normalized);
    if (existing) {
      throw new ConflictError("CNPJ já cadastrado");
    }
  }

  private async createIdentityUser(
    input: RegisterEstablishmentInput,
  ): Promise<string> {
    try {
      const created = await this.identityGateway.createUser({
        email: input.email,
        // A conta do provedor é da PESSOA que administra; o agregado é do
        // ESTABELECIMENTO. Sem `owner_name`, o nome do local é o melhor rótulo
        // disponível — melhor que deixar em branco no painel do Keycloak.
        name: input.owner_name ?? input.name,
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

  private async assignRole(externalId: string): Promise<void> {
    try {
      await this.identityGateway.assignRealmRole(externalId, "establishment");
    } catch (error) {
      await this.compensate(externalId);
      throw new ExternalServiceError(
        "Não foi possível atribuir o papel do usuário no provedor de identidade",
        { cause: error },
      );
    }
  }

  private async createEstablishment(
    input: RegisterEstablishmentInput,
    externalId: string,
  ): Promise<string> {
    try {
      const establishment = Establishment.create({
        name: input.name,
        email: input.email,
        phone: input.phone,
        cnpj: input.cnpj,
        description: input.description,
        website: input.website,
        establishment_type: input.establishment_type,
        is_active: true,
      });

      if (establishment.notification.hasErrors()) {
        throw new EntityValidationError(establishment.notification.toJSON());
      }

      // Vincular ANTES de persistir é intencional, mesma ordem (e mesmo
      // motivo) do CreateEstablishmentUseCase: se o Keycloak falhar, nada é
      // criado e o erro aparece. A ordem inversa deixaria um estabelecimento
      // no Postgres que o dono nunca conseguiria operar — o pior estado
      // possível, porque parece sucesso. O inverso (claim órfão) é inofensivo:
      // id inexistente vira 404 no use case seguinte.
      await this.identityClaims.addClaimValue(
        externalId,
        "establishment_ids",
        establishment.establishment_id.id,
      );

      await this.establishmentRepo.insert(establishment);
      return establishment.establishment_id.id;
    } catch (error) {
      await this.compensate(externalId);
      throw error;
    }
  }

  private async issueEmailVerification(establishmentId: string): Promise<void> {
    try {
      await this.emailVerificationIssuer.issueVerificationToken(
        "establishment",
        establishmentId,
      );
    } catch (error) {
      // Best-effort: a conta já é válida e o login não deve ser bloqueado por
      // uma falha de e-mail.
      console.warn(
        "RegisterEstablishmentUseCase: falha ao emitir token de verificação de email (não bloqueante)",
        JSON.stringify({
          establishment_id: establishmentId,
          error: this.describeError(error),
        }),
      );
    }
  }

  private async compensate(externalId: string): Promise<void> {
    try {
      await this.identityGateway.deleteUser(externalId);
    } catch (error) {
      console.error(
        "RegisterEstablishmentUseCase: falha ao compensar (rollback) usuário no provedor de identidade — estado órfão manual",
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
