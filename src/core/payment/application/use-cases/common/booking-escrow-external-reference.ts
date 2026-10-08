/**
 * `externalReference` da cobrança de cachê no provedor: `"escrow:<escrow_id>"`.
 *
 * O prefixo é o que permite ao webhook distinguir os três tipos de pagamento que
 * chegam pelo MESMO evento (`PAYMENT_RECEIVED`): assinatura usa `"sub:"`,
 * gorjeta usa o UUID do tip cru, e cachê usa `"escrow:"`. Sem um discriminador
 * explícito, o handler teria de adivinhar por tentativa de lookup — e um UUID
 * que não bate em nenhum repositório viraria silêncio em vez de alerta.
 *
 * Mesmo desenho de `subscription-external-reference.ts`, de propósito.
 */
const PREFIX = "escrow";

export function buildEscrowReference(escrowId: string): string {
  return `${PREFIX}:${escrowId}`;
}

export function isEscrowReference(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${PREFIX}:`);
}

/** `null` quando a referência não é de custódia ou está malformada. */
export function parseEscrowReference(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const parts = value.split(":");
  if (parts.length !== 2 || parts[0] !== PREFIX) return null;

  return parts[1] || null;
}
