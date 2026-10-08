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
 *  - Compartilhamento social: 10 pontos
 *  - Indicação de músico para estabelecimento: 15 pontos
 *
 * 🔴 **O compartilhamento valia 50 — o mesmo que um pedido ACEITO — e era a
 * ação mais fraudável do sistema** (28/set/2026). Ninguém consegue provar que
 * um compartilhamento aconteceu: `imageShare.ts` registra no próprio código
 * que o SO não distingue "compartilhou" de "abriu o menu e cancelou". Somado à
 * ausência de dedupe, vinte toques num botão davam os 1000 pontos de `isTopFan`
 * — e o leaderboard é público.
 *
 * A correção tem duas partes, e nenhuma funciona sozinha: o valor caiu para a
 * ordem de `SCAN_QR` (ação leve, não verificável) e o crédito passou a ser
 * único POR CONTEÚDO (ver `RegisterSocialShareUseCase`). Os 50 pontos ficam
 * reservados à missão 7.11, que exige PROVA do post — é o que o roadmap 7.3 já
 * mandava tratar como fonte única deste tema.
 */
export enum GamificationAction {
  SCAN_QR = "scan_qr",
  REQUEST = "request",
  ACCEPTED_REQUEST = "accepted_request",
  TIP = "tip",
  SOCIAL_SHARE = "social_share",
  INDICATION = "indication",
  PROFILE_VIEW = "profile_view",
  EVENT_ATTENDANCE = "event_attendance",
  BONUS = "bonus",
}

export const GAMIFICATION_POINTS: Record<GamificationAction, number> = {
  [GamificationAction.SCAN_QR]: 10,
  [GamificationAction.REQUEST]: 25,
  [GamificationAction.ACCEPTED_REQUEST]: 50,
  [GamificationAction.TIP]: 1, // 1 ponto por real
  [GamificationAction.SOCIAL_SHARE]: 10,
  [GamificationAction.INDICATION]: 15,
  [GamificationAction.PROFILE_VIEW]: 5,
  [GamificationAction.EVENT_ATTENDANCE]: 20,
  [GamificationAction.BONUS]: 0, // valor variável
};

export function getGamificationPoints(action: GamificationAction): number {
  return GAMIFICATION_POINTS[action] ?? 0;
}
