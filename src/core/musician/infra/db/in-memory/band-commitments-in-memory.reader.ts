import { BandId } from "../../../domain/band.aggregate";
import {
  BandCommitments,
  IBandCommitmentsReader,
} from "../../../domain/band-commitments.reader";

const NOTHING: BandCommitments = {
  open: {
    upcoming_bookings: 0,
    open_inquiries: 0,
    held_escrows: 0,
    live_performances: 0,
  },
  has_history: false,
};

/**
 * Leitor em memória para testes: banda sem registro não tem compromisso nem
 * histórico; o teste declara o resto com `set`.
 */
export class BandCommitmentsInMemoryReader implements IBandCommitmentsReader {
  private readonly byBand = new Map<string, BandCommitments>();

  set(
    band_id: BandId,
    commitments: {
      open?: Partial<BandCommitments["open"]>;
      has_history?: boolean;
    },
  ): void {
    this.byBand.set(band_id.id, {
      open: { ...NOTHING.open, ...(commitments.open ?? {}) },
      has_history: commitments.has_history ?? false,
    });
  }

  async summarize(band_id: BandId): Promise<BandCommitments> {
    return this.byBand.get(band_id.id) ?? NOTHING;
  }
}
