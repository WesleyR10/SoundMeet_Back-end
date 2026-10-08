/**
 * Escreve, no provedor de identidade, o vínculo entre a conta e os agregados
 * que ela passa a operar.
 *
 * Existe porque estabelecimento e banda têm UUID próprio, distinto do `sub` do
 * JWT — diferente de músico e público, cujo `aggregate_id == sub`. O elo mora
 * nos claims `establishment_ids` / `band_ids`, e sem ele os ownership guards
 * (`EstablishmentOwnershipGuard`, `BandOwnershipGuard`) e as policies de
 * negociação trancam o usuário para fora do que ele acabou de criar.
 *
 * A escrita é aditiva: uma conta pode acumular vários estabelecimentos e
 * bandas, então nunca sobrescrever a lista existente.
 *
 * ⚠️ O claim é ESCOPO, não autorização. Ele decide quais negociações,
 * contratos e conversas entram nas listas do usuário; quem pode ALTERAR uma
 * banda é conferido no banco a cada chamada (`assertBandLeader`). Um JWT é
 * fotografia de 15 minutos e a liderança muda entre uma requisição e outra.
 */
export type IdentityClaimAttribute = "establishment_ids" | "band_ids";

export interface IIdentityClaimsWriter {
  addClaimValue(
    userId: string,
    attribute: IdentityClaimAttribute,
    value: string,
  ): Promise<void>;

  /**
   * Tira um valor do atributo. Idempotente: remover o que não está lá não é
   * erro.
   *
   * Existe porque o vínculo com uma banda deixa de valer — a liderança é
   * transferida, a banda é apagada. Sem remoção, o claim só crescia: o
   * ex-líder continuava com a agenda e os contratos da banda no seu escopo
   * para sempre.
   */
  removeClaimValue(
    userId: string,
    attribute: IdentityClaimAttribute,
    value: string,
  ): Promise<void>;
}
