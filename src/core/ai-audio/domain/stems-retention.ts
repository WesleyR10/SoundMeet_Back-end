/**
 * Prazo de retenção dos stems separados.
 *
 * 🔴 **Por que existe prazo.** O `ai-cifra` nunca retém a gravação: apaga o
 * objeto no instante em que a análise conclui e guarda só o dado derivado (a
 * folha de cifra). Stem não é dado derivado no mesmo sentido — **stem é a
 * gravação, separada**. Guardar os quatro por tempo indeterminado, servidos por
 * URL, seria uma postura de direito autoral diferente da que o resto do projeto
 * escolheu, além de storage crescendo sem teto.
 *
 * O prazo é curto de propósito: cobre a sessão de ensaio e alguns dias de
 * revisita, não vira acervo. Vencido, o áudio sai e o job passa a `expired` —
 * pedir de novo custa uma passada de GPU, que é o preço combinado.
 */
export const DEFAULT_STEMS_RETENTION_HOURS = 72;

/** Piso de 1h: prazo zero apagaria os stems antes do ensaio começar. */
export function stemsExpiryFrom(retentionHours: number, now: Date): Date {
  const hours = Math.max(1, Math.floor(retentionHours));
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}
