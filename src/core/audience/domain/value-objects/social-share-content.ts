/**
 * O que foi compartilhado.
 *
 * 🔴 Existe para tornar o crédito DEDUPLICÁVEL. Até 28/set/2026 o
 * compartilhamento só carregava `request_id` e valia 50 pontos sem nenhuma
 * verificação: chamar a rota em laço dava os 1000 pontos de `isTopFan`, e o
 * leaderboard é público. O par (tipo, id) identifica a PEÇA de conteúdo, que é
 * a granularidade certa do crédito — um por recibo de gorjeta, um por card de
 * show —, em vez de um por toque no botão.
 *
 * ⚠️ Compartilhar de novo continua funcionando e é legítimo (mandar o card para
 * outro grupo). O que não acontece duas vezes é o CRÉDITO.
 *
 * O vocabulário espelha o que o app realmente sabe compartilhar hoje
 * (`imageShare.ts`): recibo de gorjeta, card de pós-show e o QR do músico.
 */
export const SOCIAL_SHARE_CONTENT_TYPES = [
  "tip_receipt",
  "show_recap",
  "qr_code",
  "request",
] as const;

export type SocialShareContentType =
  (typeof SOCIAL_SHARE_CONTENT_TYPES)[number];

/**
 * Chave de referência usada no ledger (`UserScore.reference_id`).
 *
 * Prefixar com o tipo evita colisão entre ids de domínios diferentes: um
 * `request_id` e um `performance_id` são ambos UUID e poderiam coincidir por
 * acidente de seed ou de importação — e a colisão se manifestaria como um
 * crédito silenciosamente negado.
 */
export function socialShareReference(
  contentType: SocialShareContentType,
  contentId: string,
): string {
  return `${contentType}:${contentId}`;
}
