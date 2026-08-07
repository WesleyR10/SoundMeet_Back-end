import { AuthUser } from "./auth.roles";
import { AuthenticatedUser } from "./interfaces/authenticated-user.interface";

/**
 * Fonte única de verdade para derivar identidade a partir dos claims do JWT.
 *
 * HTTP (CurrentUserContextGuard) e WebSocket (ChatGateway) precisam enxergar
 * exatamente o mesmo ator; duplicar a leitura dos claims em cada transporte
 * abre espaço para um caminho aceitar o que o outro recusa.
 */
export function toAuthenticatedUser(
  payload: AuthUser & Record<string, any>,
): AuthenticatedUser {
  const roles = payload.roles ?? [];

  return {
    userId: payload.sub ?? "",
    roles,
    establishmentIds: payload.establishment_ids ?? [],
    bandIds: payload.band_ids ?? [],
    organizationId: payload.organization_id,
    isAdmin: roles.includes("admin"),
  };
}

/**
 * Todas as identidades sob as quais o usuário pode figurar como participante de
 * um recurso: o próprio `sub` (músico/público) e os ids de estabelecimento e
 * banda que os claims lhe atribuem.
 */
export function resolveParticipantIds(user: AuthenticatedUser): string[] {
  return [user.userId, ...user.establishmentIds, ...user.bandIds].filter(
    (id): id is string => !!id,
  );
}
