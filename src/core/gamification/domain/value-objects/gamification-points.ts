/**
 * Fonte única de verdade para os valores de pontuação da gamificação.
 *
 * Tanto PointsSource (usado na projeção UserPoints) quanto ScoreType
 * (usado no ledger UserScore) derivam seus valores deste mapa, evitando
 * lógica de pontuação duplicada/divergente entre os dois conceitos.
 *
 * Regra de negócio (Docs/ai-agent-development-rules.md):
 *  - Scan QR: 10 pontos
 *  - Pedido musical: 25 pontos
 *  - Acerto de sugestão (pedido aceito): 50 pontos
 *  - Gorjeta: 1 ponto por real
 *  - Compartilhamento social: 50 pontos
 */
export enum GamificationAction {
  SCAN_QR = "scan_qr",
  REQUEST = "request",
  ACCEPTED_REQUEST = "accepted_request",
  TIP = "tip",
  SOCIAL_SHARE = "social_share",
  PROFILE_VIEW = "profile_view",
  EVENT_ATTENDANCE = "event_attendance",
  BONUS = "bonus",
}

export const GAMIFICATION_POINTS: Record<GamificationAction, number> = {
  [GamificationAction.SCAN_QR]: 10,
  [GamificationAction.REQUEST]: 25,
  [GamificationAction.ACCEPTED_REQUEST]: 50,
  [GamificationAction.TIP]: 1, // 1 ponto por real
  [GamificationAction.SOCIAL_SHARE]: 50,
  [GamificationAction.PROFILE_VIEW]: 5,
  [GamificationAction.EVENT_ATTENDANCE]: 20,
  [GamificationAction.BONUS]: 0, // valor variável
};

export function getGamificationPoints(action: GamificationAction): number {
  return GAMIFICATION_POINTS[action] ?? 0;
}
