import { BandId } from "./band.aggregate";

/**
 * O que ainda está EM ABERTO em nome da banda — cada item é algo que outra
 * pessoa está esperando dela.
 */
export type BandOpenCommitments = {
  /** Shows propostos ou confirmados que ainda não terminaram. */
  upcoming_bookings: number;
  /** Conversas de contratação abertas ou aceitas, ainda não convertidas. */
  open_inquiries: number;
  /** Cachê em custódia que ainda não foi liberado nem devolvido. */
  held_escrows: number;
  /** Set no ar agora. */
  live_performances: number;
};

export type BandCommitments = {
  open: BandOpenCommitments;
  /**
   * A banda aparece em algum registro de outro agregado (proposta, conversa,
   * line-up, gorjeta, lançamento, contrato, set) — mesmo que tudo já tenha
   * terminado.
   */
  has_history: boolean;
};

/**
 * Porta de leitura: o que a banda tem pendurado em outros domínios.
 *
 * Mora em `musician` (quem pergunta) e é implementada com contagens diretas
 * (quem responde), sem importar `scheduling`, `payment` nem `performance` —
 * esses três já dependem de `musician`, e o caminho de volta fecharia ciclo.
 * Mesmo desenho de `IEmailVerificationChecker`.
 */
export interface IBandCommitmentsReader {
  summarize(band_id: BandId, now: Date): Promise<BandCommitments>;
}

export function hasOpenCommitments(open: BandOpenCommitments): boolean {
  return (
    open.upcoming_bookings > 0 ||
    open.open_inquiries > 0 ||
    open.held_escrows > 0 ||
    open.live_performances > 0
  );
}
