import { ForbiddenException } from "@nestjs/common";

/**
 * Quem enxerga um pedido musical, derivado exclusivamente do JWT.
 *
 * `requesting_participant_ids` carrega TODAS as identidades do usuário — o
 * `sub` (fã ou músico) mais os claims `establishment_ids`. Um id só não dá
 * conta: fã e músico têm `aggregate_id == sub`, mas o estabelecimento tem UUID
 * próprio, e comparar o `sub` dele contra `event.establishment_id` nunca casa.
 */
export type RequestViewer = {
  requesting_participant_ids?: string[] | null;
  is_admin?: boolean;
};

export type RequestParticipants = {
  audience_id?: string | null;
  musician_id?: string | null;
  establishment_id?: string | null;
};

/** Sem ator identificado a checagem é pulada — chamada interna/job. */
export function isRequestViewerScoped(viewer: RequestViewer): boolean {
  return (
    !viewer.is_admin &&
    (viewer.requesting_participant_ids ?? []).filter(Boolean).length > 0
  );
}

/**
 * Escopo de um pedido: quem pediu, o músico-alvo e o estabelecimento dono do
 * evento. Ids do corpo/URL nunca autorizam — eles apontam o alvo, e é a
 * identidade assinada pelo Keycloak que decide se o alvo pode ser aberto.
 */
export function assertRequestParticipant(
  viewer: RequestViewer,
  participants: RequestParticipants,
  resource: string,
): void {
  if (!isRequestViewerScoped(viewer)) {
    return;
  }

  const viewerIds = (viewer.requesting_participant_ids ?? []).filter(Boolean);
  const isParticipant = [
    participants.audience_id,
    participants.musician_id,
    participants.establishment_id,
  ].some((id) => !!id && viewerIds.includes(id));

  if (!isParticipant) {
    throw new ForbiddenException(
      `Você não tem permissão para ver ${resource}.`,
    );
  }
}
