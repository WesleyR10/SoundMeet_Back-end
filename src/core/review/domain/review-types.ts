/**
 * Vocabulário do domínio de avaliação, extraído do agregado.
 *
 * Mora em arquivo próprio porque `review.validator.ts` precisa das listas em
 * runtime (para `@IsIn`) e o agregado importa o validator — importar de volta
 * criaria ciclo e quebraria com `Cannot access 'X' before initialization`.
 * Mesmo precedente de `musician/domain/band-member-role.ts`.
 */

/** Quem está sendo avaliado. */
export const REVIEW_TARGET_TYPES = ["musician", "establishment"] as const;
export type ReviewTargetType = (typeof REVIEW_TARGET_TYPES)[number];

/** Quem avaliou — determina qual prova de vínculo é exigida. */
export const REVIEW_AUTHOR_TYPES = [
  "audience",
  "musician",
  "establishment",
] as const;
export type ReviewAuthorType = (typeof REVIEW_AUTHOR_TYPES)[number];

/**
 * O que prova que autor e alvo realmente se encontraram.
 * `event` → o fã esteve no evento (`EventAttendee`).
 * `booking` → músico e estabelecimento fecharam um show concluído.
 */
export const REVIEW_CONTEXT_TYPES = ["event", "booking"] as const;
export type ReviewContextType = (typeof REVIEW_CONTEXT_TYPES)[number];
