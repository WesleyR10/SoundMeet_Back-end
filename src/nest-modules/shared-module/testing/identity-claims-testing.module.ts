import { Global, Module } from "@nestjs/common";

import { NoopIdentityClaimsWriter } from "../../../core/auth/infra/gateways/noop-identity-claims.writer";
import { IDENTITY_CLAIMS_WRITER } from "../../auth-module/auth.providers";

/**
 * Fornece o `IdentityClaimsWriter` para um app de teste que sobe um módulo de
 * domínio SEM o `AuthModule`.
 *
 * Em produção quem provê o token é o `AuthModule`, que é `@Global()`. Os e2e
 * que montam só `MusiciansModule` (para não arrastar o Keycloak para dentro de
 * um cenário que não o testa) ficavam sem ele desde que `CreateBandUseCase`
 * passou a gravar o claim `band_ids`: o Nest não resolvia a dependência e o
 * app nem subia. `presentation-audio.e2e-spec.ts` ficou quebrado assim, em
 * silêncio — e2e não roda no `npm test`.
 *
 * É o writer no-op de verdade (`AUTH_JWT_VALIDATION_MODE = local`), não um
 * mock: mesma classe que o `AuthModule` usa fora do modo Keycloak.
 */
@Global()
@Module({
  providers: [
    { provide: IDENTITY_CLAIMS_WRITER, useClass: NoopIdentityClaimsWriter },
  ],
  exports: [IDENTITY_CLAIMS_WRITER],
})
export class IdentityClaimsTestingModule {}
