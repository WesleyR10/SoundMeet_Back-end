/**
 * Papel de um integrante dentro da banda.
 *
 * Vive fora de `band.aggregate.ts` porque `band.validator.ts` precisa da lista
 * em tempo de decoração (`@IsIn`), e o agregado já importa o validator — ler a
 * constante do agregado fecharia um ciclo e estouraria TDZ na carga do módulo.
 */
export const BAND_MEMBER_ROLES = ["leader", "member"] as const;

export type BandMemberRole = (typeof BAND_MEMBER_ROLES)[number];

/**
 * Aceita variações de caixa e espaço ("Leader", " LEADER ") porque o papel
 * chega de DTO e de linhas legadas gravadas quando a coluna era texto livre.
 * `"Leader"` virando um papel desconhecido silenciaria a liderança inteira —
 * o líder perderia acesso às próprias decisões sem nenhum erro visível.
 * Qualquer coisa fora do conjunto devolve null: o chamador decide se erra ou
 * cai para "member", nunca promove por acidente.
 */
export function parseBandMemberRole(value: unknown): BandMemberRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return (BAND_MEMBER_ROLES as readonly string[]).includes(normalized)
    ? (normalized as BandMemberRole)
    : null;
}
