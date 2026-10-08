/**
 * Estados da custódia do cachê.
 *
 * ```
 *   pending ──► held ──┬──► released
 *                      ├──► refunded
 *                      └──► disputed ──┬──► released
 *                                      └──► refunded
 * ```
 *
 * `disputed` **não** é terminal de propósito: contestação congela a liberação
 * automática e manda o caso para mediação, e a mediação termina em alguém
 * recebendo. Um estado terminal aqui deixaria dinheiro parado para sempre.
 */
export enum BookingEscrowStatus {
  PENDING = "pending",
  HELD = "held",
  RELEASED = "released",
  REFUNDED = "refunded",
  DISPUTED = "disputed",
}
