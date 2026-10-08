import { BookingId } from "../../../../scheduling/domain/booking.aggregate";
import { IBookingRepository } from "../../../../scheduling/domain/booking.repository";
import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IBookingEscrowRepository } from "../../../domain/repositories/booking-escrow.repository";
import { ReleaseBookingEscrowUseCase } from "../release-booking-escrow/release-booking-escrow.use-case";

export type ProcessDueEscrowReleasesInput = {
  limit?: number;
};

export type ProcessDueEscrowReleasesOutput = {
  examined: number;
  released: number;
  skipped: { escrow_id: string; reason: string }[];
};

/** Resolve o holdback do músico (D+2 pago / D+5 FREE). */
export type EscrowReleaseDaysResolver = {
  getMusicianEscrowReleaseDays(musician_id: string): Promise<number>;
};

export type ProcessDueEscrowReleasesDeps = {
  escrowRepo: IBookingEscrowRepository;
  bookingRepo: IBookingRepository;
  releaseUseCase: ReleaseBookingEscrowUseCase;
  planResolver: EscrowReleaseDaysResolver;
  clock?: IClock;
  /**
   * Menor holdback de qualquer plano — o limite da varredura.
   *
   * A busca precisa de UM corte, mas o prazo varia por plano. Cortar pelo MAIOR
   * prazo esconderia do job justamente o músico PRO, que deveria receber
   * primeiro; cortar pelo MENOR traz candidatos demais e cada um é conferido
   * contra o próprio plano depois. Errar para o lado de examinar demais é
   * barato; errar para o lado de não examinar é dinheiro parado sem ninguém
   * perceber.
   */
  minReleaseDays?: number;
  batchLimit?: number;
};

const DEFAULT_MIN_RELEASE_DAYS = 2;
const DEFAULT_BATCH_LIMIT = 200;
const MS_PER_DAY = 86_400_000;

/**
 * Varredura que libera as custódias cujo prazo venceu.
 *
 * ## As duas condições, e por que as duas
 *
 * 1. **Check-in registrado** — prova de que a apresentação aconteceu;
 * 2. **Sem contestação** dentro da janela.
 *
 * Liberar só por prazo, sem check-in, entregaria o cachê de um show que
 * ninguém confirmou ter acontecido. Liberar com contestação aberta seria
 * decidir a disputa a favor de um lado por omissão — e a mediação é humana de
 * propósito.
 *
 * ## Por que nada aqui derruba a varredura
 *
 * Uma custódia problemática (booking sumido, provedor recusando) não pode
 * impedir as outras de serem liberadas: seria uma falha isolada travando o
 * pagamento de todo mundo. Cada item é isolado e o motivo do pulo volta no
 * output, que é o que o job loga.
 */
export class ProcessDueEscrowReleasesUseCase implements IUseCase<
  ProcessDueEscrowReleasesInput,
  ProcessDueEscrowReleasesOutput
> {
  private readonly clock: IClock;

  constructor(private readonly deps: ProcessDueEscrowReleasesDeps) {
    this.clock = deps.clock ?? { now: () => new Date() };
  }

  async execute(
    input: ProcessDueEscrowReleasesInput = {},
  ): Promise<ProcessDueEscrowReleasesOutput> {
    const now = this.clock.now();
    const minDays = this.deps.minReleaseDays ?? DEFAULT_MIN_RELEASE_DAYS;
    const limit = input.limit ?? this.deps.batchLimit ?? DEFAULT_BATCH_LIMIT;

    const candidates = await this.deps.escrowRepo.findReleasable(
      new Date(now.getTime() - minDays * MS_PER_DAY),
      limit,
    );

    const skipped: { escrow_id: string; reason: string }[] = [];
    let released = 0;

    for (const escrow of candidates) {
      try {
        const reason = await this.blockingReason(escrow, now);
        if (reason) {
          skipped.push({ escrow_id: escrow.escrow_id.id, reason });
          continue;
        }

        await this.deps.releaseUseCase.execute({
          escrow_id: escrow.escrow_id.id,
          note: "Liberação automática: apresentação registrada e prazo de contestação vencido.",
        });
        released += 1;
      } catch (error) {
        skipped.push({
          escrow_id: escrow.escrow_id.id,
          reason: error instanceof Error ? error.message : "erro desconhecido",
        });
      }
    }

    return { examined: candidates.length, released, skipped };
  }

  /** `null` = pode liberar. */
  private async blockingReason(
    escrow: {
      escrow_id: { id: string };
      booking_id: { id: string };
      musician_id: { id: string } | null;
      held_at: Date | null;
    },
    now: Date,
  ): Promise<string | null> {
    const booking = await this.deps.bookingRepo.findById(
      new BookingId(escrow.booking_id.id),
    );
    if (!booking) return "booking não encontrado";
    if (!booking.isCheckedIn) return "apresentação não registrada";
    if (booking.isDisputed) return "contestação em aberto";

    /*
     * O prazo conta do FIM DO SHOW, não do momento em que o dinheiro entrou: o
     * pagamento é antecipado, então contar da retenção liberaria antes de o
     * show acontecer para quem pagou com muita antecedência.
     */
    const days = escrow.musician_id
      ? await this.deps.planResolver.getMusicianEscrowReleaseDays(
          escrow.musician_id.id,
        )
      : (this.deps.minReleaseDays ?? DEFAULT_MIN_RELEASE_DAYS);

    const dueAt = new Date(booking.end_at.getTime() + days * MS_PER_DAY);
    if (now < dueAt) {
      return `prazo de contestação em curso (vence em ${dueAt.toISOString()})`;
    }

    return null;
  }
}
