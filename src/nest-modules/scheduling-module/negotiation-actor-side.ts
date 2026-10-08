import { AuthenticatedUser } from "../auth-module/interfaces/authenticated-user.interface";

/**
 * Lado da negociação em que o autenticado está agindo.
 *
 * Serve a `cancelled_by` (quem cancelou) e a `proposed_by` (quem propôs) — é a
 * mesma pergunta feita em dois momentos, então é uma função só. Sempre derivada
 * do JWT, nunca do corpo: os dois campos descrevem autoria, e autoria vinda de
 * input do cliente é forjável.
 *
 * Mora fora do `BookingsController` desde que a conversão de inquiry (outro
 * controller) passou a registrar `proposed_by` também.
 */
export function deriveActorSide(
  user: AuthenticatedUser,
): "establishment" | "musician" | "band" {
  if (user.roles.includes("musician")) return "musician";
  if (user.roles.includes("band")) return "band";
  return "establishment";
}
