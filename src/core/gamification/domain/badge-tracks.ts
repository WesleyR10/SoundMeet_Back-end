import { BadgeTypeEnum } from "./value-objects/badge-type.vo";
import { ScoreTypeEnum } from "./value-objects/score-type.vo";

/**
 * De onde vem o progresso de cada conquista — em PONTOS do ledger.
 *
 * ## Por que existe (29/set/2026)
 *
 * O catálogo (`BadgeTypeEnum` + `getRequiredPoints`) existia desde o começo,
 * mas NADA avançava uma conquista: `AwardBadgeUseCase` só era chamado pela
 * rota de admin. O fã pontuava, subia de nível, e a vitrine de conquistas
 * seguia vazia — só o seed escrevia linhas em `user_badges`.
 *
 * ## Derivado, nunca acumulado
 *
 * O progresso é a SOMA dos lançamentos do `UserScore` dos tipos que a
 * conquista escuta, recalculada a cada crédito (`SyncUserBadgesUseCase`).
 * Acumular `+pontos` a cada evento divergiria do ledger na primeira falha
 * entre os dois `insert`; derivando, um sync perdido é corrigido pelo próximo,
 * e quem já tinha pontos antes desta regra recebe as conquistas no primeiro
 * crédito seguinte — sem migration de backfill.
 *
 * `ALL` = qualquer lançamento conta (é o que "primeiros passos" e "maior fã"
 * afirmam). Os limiares continuam em `BadgeType.getRequiredPoints` — este
 * arquivo só diz de ONDE os pontos vêm.
 */
export const ALL_SCORE_TYPES = "all" as const;

export const BADGE_TRACKS: Record<
  BadgeTypeEnum,
  readonly ScoreTypeEnum[] | typeof ALL_SCORE_TYPES
> = {
  // "Primeiros passos no mundo musical"
  [BadgeTypeEnum.INICIANTE_MUSICAL]: ALL_SCORE_TYPES,
  // "Especialista em sugestões musicais" — pedir é sugerir.
  [BadgeTypeEnum.SUGESTOR_CRIATIVO]: [ScoreTypeEnum.REQUEST_SENT],
  // "Acerta sempre nas sugestões" — só o pedido que o músico ACEITOU.
  [BadgeTypeEnum.ACERTADOR]: [ScoreTypeEnum.REQUEST_ACCEPTED],
  // "Apoia músicos com gorjetas" / "Grande apoiador" — 1 ponto por real.
  [BadgeTypeEnum.APOIADOR]: [ScoreTypeEnum.TIP_GIVEN],
  [BadgeTypeEnum.MECENAS]: [ScoreTypeEnum.TIP_GIVEN],
  // "Compartilha e conecta pessoas" — o crédito de share já é deduplicado
  // por conteúdo no ledger (Bloco 16), então não há como farmar daqui.
  [BadgeTypeEnum.SOCIALIZER]: [ScoreTypeEnum.SOCIAL_SHARE],
  // "Descobre novos talentos" — chegar no show de alguém (QR) e indicar
  // artista para uma casa.
  [BadgeTypeEnum.DISCOVERER]: [ScoreTypeEnum.QR_SCAN, ScoreTypeEnum.INDICATION],
  // "O maior fã da plataforma"
  [BadgeTypeEnum.SUPER_FA]: ALL_SCORE_TYPES,
};

export type PointsByScoreType = Partial<Record<string, number>>;

/**
 * Progresso de cada conquista a partir das somas do ledger por tipo.
 *
 * Soma negativa (estorno lançado como ponto negativo) nunca faz o progresso
 * ficar abaixo de zero: `UserBadge.updateProgress` recusa negativo, e uma
 * conquista já desbloqueada não é revogada por aqui.
 */
export function badgeProgressFromLedger(
  pointsByType: PointsByScoreType,
): Record<BadgeTypeEnum, number> {
  const total = Object.values(pointsByType).reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );

  const progress = {} as Record<BadgeTypeEnum, number>;
  for (const badge of Object.values(BadgeTypeEnum)) {
    const track = BADGE_TRACKS[badge];
    const points =
      track === ALL_SCORE_TYPES
        ? total
        : track.reduce((sum, type) => sum + (pointsByType[type] ?? 0), 0);
    // Coluna `progress` é Int: fração de real da gorjeta não vira ponto.
    progress[badge] = Math.max(0, Math.floor(points));
  }
  return progress;
}
