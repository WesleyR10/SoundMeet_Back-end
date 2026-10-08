/**
 * Vocabulário do domínio de contrato, extraído do agregado.
 *
 * Mora em arquivo próprio porque `contract.validator.ts` precisa das listas em
 * runtime (para `@IsIn`) e o agregado importa o validator — importar de volta
 * criaria ciclo e quebraria com `Cannot access 'X' before initialization`.
 * Mesmo precedente de `review/domain/review-types.ts` e
 * `musician/domain/band-member-role.ts`.
 */

/**
 * Estados do contrato emitido.
 *
 * **Não existe `draft`.** Um rascunho não teria produtor: a emissão é automática
 * no `BookingConfirmedEvent` e nasce completa. Estado sem produtor vira coluna
 * morta — é exatamente o erro do `base_version` registrado no roadmap.
 *
 * `annulled` (e não `void`) porque `void` é palavra reservada em TypeScript e
 * `contract.void()` não é um método que se possa escrever.
 */
export const CONTRACT_STATUSES = [
  "issued",
  "partially_signed",
  "signed",
  "annulled",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

/**
 * Os dois lados do contrato.
 *
 * `contractor` é sempre o estabelecimento e `contracted` sempre o músico ou a
 * banda — a plataforma nunca é parte. Ver a cláusula `papel_da_plataforma`.
 */
export const CONTRACT_PARTY_ROLES = ["contractor", "contracted"] as const;
export type ContractPartyRole = (typeof CONTRACT_PARTY_ROLES)[number];

/** Pessoa física (CPF) ou jurídica (CNPJ). Muda a qualificação e os tributos. */
export const CONTRACT_PARTY_KINDS = ["individual", "company"] as const;
export type ContractPartyKind = (typeof CONTRACT_PARTY_KINDS)[number];

/**
 * De onde veio o endereço IP registrado numa assinatura.
 *
 * 🔴 Todo o `soundmeet-web` sai de um IP só (é o mesmo fato do item aberto de
 * rate limit, `roadmap-backend.md` §9.7). Gravar o IP do BFF como "IP do signatário"
 * seria evidência falsa — e evidência que exagera é evidência que o outro lado
 * derruba. A trilha registra o que enxergamos E a procedência do que enxergamos.
 */
export const CONTRACT_IP_SOURCES = ["direct", "proxied", "unknown"] as const;
export type ContractIpSource = (typeof CONTRACT_IP_SOURCES)[number];

/**
 * Como a assinatura foi coletada.
 *
 * Hoje só existe `platform_acceptance` (aceite eletrônico próprio, MP 2.200-2
 * art. 10 §2º). O valor viaja no snapshot congelado para que um contrato
 * assinado hoje continue dizendo COMO foi assinado quando existir um provedor
 * externo — sem isso, contratos antigos e novos seriam indistinguíveis.
 */
export const CONTRACT_SIGNATURE_METHODS = ["platform_acceptance"] as const;
export type ContractSignatureMethod =
  (typeof CONTRACT_SIGNATURE_METHODS)[number];
