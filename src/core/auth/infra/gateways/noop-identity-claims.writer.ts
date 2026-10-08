import { Logger } from "@nestjs/common";

import {
  IdentityClaimAttribute,
  IIdentityClaimsWriter,
} from "../../../shared/application/identity-claims.interface";

/**
 * Usado quando a API não valida tokens via Keycloak (`AUTH_JWT_VALIDATION_MODE
 * = local`, dev/teste isolados). Nesse modo os claims vêm de um JWT assinado
 * localmente e não há Admin API para escrever atributo — chamar o Keycloak aqui
 * só faria a criação de estabelecimento/banda falhar com o serviço fora do ar.
 *
 * Loga em nível warn porque, se isso aparecer em ambiente que usa Keycloak, é
 * sinal de config errada: o dono não vai receber o claim e ficará sem acesso.
 */
export class NoopIdentityClaimsWriter implements IIdentityClaimsWriter {
  private readonly logger = new Logger(NoopIdentityClaimsWriter.name);

  async addClaimValue(
    userId: string,
    attribute: IdentityClaimAttribute,
    value: string,
  ): Promise<void> {
    this.logger.warn(
      JSON.stringify({
        event: "identity.claim_link_skipped",
        reason: "auth_mode_is_local",
        user_id: userId,
        attribute,
        value,
      }),
    );
  }

  async removeClaimValue(
    userId: string,
    attribute: IdentityClaimAttribute,
    value: string,
  ): Promise<void> {
    this.logger.warn(
      JSON.stringify({
        event: "identity.claim_unlink_skipped",
        reason: "auth_mode_is_local",
        user_id: userId,
        attribute,
        value,
      }),
    );
  }
}
