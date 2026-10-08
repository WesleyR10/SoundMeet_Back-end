/**
 * Parâmetros operacionais da custódia do cachê (F1.3a).
 *
 * ⚠️ **Taxa NÃO mora aqui.** O percentual retido sobre o cachê é
 * `booking_fee_percentage`, em `plans/domain/plan-features.config.ts`, junto de
 * `tip_fee_percentage`, `escrow_release_days` e o resto da tabela comercial —
 * toda taxa do sistema muda num arquivo só, e ela pode variar por plano. O que
 * sobra aqui é prazo operacional, que não é decisão de plano.
 */

/**
 * Prazo para o estabelecimento pagar o cachê, contado para trás a partir do
 * início do show.
 *
 * `decisoes-de-gateway.md`: "até 48h antes do show — não pagar = booking
 * cancelado automaticamente". Aqui só define o vencimento da cobrança; o
 * cancelamento automático é outra fatia.
 */
export const BOOKING_ESCROW_DUE_HOURS_BEFORE_SHOW = 48;
