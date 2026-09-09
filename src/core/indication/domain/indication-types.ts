/**
 * Estado da indicação do ponto de vista de QUEM RECEBE.
 *
 * O fã não altera nada aqui: ele indica e pronto. Isto é a caixa de entrada do
 * estabelecimento — é ele quem marca como vista ou arquiva.
 *
 * Arquivo separado do agregado pelo mesmo motivo de `review-types.ts`: o
 * validator precisa das listas em runtime e o agregado importa o validator; o
 * ciclo quebra com `Cannot access before initialization`.
 */
export const INDICATION_STATUSES = ["new", "seen", "archived"] as const;

export type IndicationStatus = (typeof INDICATION_STATUSES)[number];
