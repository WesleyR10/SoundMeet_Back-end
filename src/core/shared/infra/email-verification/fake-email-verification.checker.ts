import { IEmailVerificationChecker } from "../../domain/email-verification.checker";

/**
 * Fake para testes — espelha `FakeGeocodingService`.
 *
 * O default é `true` (verificado) porque a esmagadora maioria dos testes que
 * tocam saque está exercitando OUTRA coisa (saldo, lock, idempotência) e teria
 * de ligar o e-mail em toda montagem. Quem testa o gate seta `false`
 * explicitamente — e existe teste para os dois lados.
 */
export class FakeEmailVerificationChecker implements IEmailVerificationChecker {
  constructor(private verified = true) {}

  async isMusicianEmailVerified(_musicianId: string): Promise<boolean> {
    return this.verified;
  }

  setVerified(verified: boolean): void {
    this.verified = verified;
  }
}
