/**
 * O que um fã pode seguir.
 *
 * Banda fica FORA da v1: ela não tem página pública própria no app do fã, e
 * seguir algo que não se encontra seria um botão sem chão.
 *
 * Arquivo separado do agregado pelo mesmo motivo de `indication-types.ts`: o
 * validator precisa da lista em runtime e o agregado importa o validator.
 */
export const FOLLOW_TARGET_TYPES = ["musician", "establishment"] as const;

export type FollowTargetType = (typeof FOLLOW_TARGET_TYPES)[number];

export type FollowTarget = {
  target_type: FollowTargetType;
  target_id: string;
};

/**
 * Por que um seguidor foi avisado. É a chave do ledger de entrega
 * (`notification_deliveries`): o mesmo fã recebe no máximo UMA notificação de
 * cada tipo por evento — seguir o músico E a casa do mesmo show não dobra o
 * aviso, e um handler que reentra não reenvia.
 */
export const FOLLOW_NOTIFICATION_KINDS = [
  "show_announced",
  "artist_confirmed",
  "started_now",
  "day_reminder",
  "show_cancelled",
] as const;

export type FollowNotificationKind = (typeof FOLLOW_NOTIFICATION_KINDS)[number];
