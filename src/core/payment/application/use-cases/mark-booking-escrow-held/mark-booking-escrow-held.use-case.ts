import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { IUnitOfWork } from "../../../../shared/domain/repository/unit-of-work.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  BookingEscrow,
  BookingEscrowId,
} from "../../../domain/booking-escrow.aggregate";
import { BookingEscrowStatus } from "../../../domain/booking-escrow-enums";
import { IBookingEscrowRepository } from "../../../domain/repositories/booking-escrow.repository";
import { IMusicianWalletRepository } from "../../../domain/repositories/musician-wallet.repository";

export type MarkBookingEscrowHeldInput = {
  escrow_id: string;
  /** Id da cobrança no provedor — a âncora para liberar/estornar depois. */
  external_id: string;
  expires_at?: Date | null;
};

export type MarkBookingEscrowHeldOutput = {
  escrow_id: string;
  status: string;
  held_amount: number;
  /** `false` quando a custódia já estava retida (reentrega de webhook). */
  changed: boolean;
};

export type MarkBookingEscrowHeldDeps = {
  escrowRepo: IBookingEscrowRepository;
  walletRepo: IMusicianWalletRepository;
  /**
   * Custódia e carteira mudam JUNTAS ou não mudam.
   *
   * Sem transação, uma falha entre os dois updates deixaria a custódia `held` e
   * o `held_balance` zerado — e a reentrega do webhook não repara, porque o
   * agregado já está `held` e `markHeld` vira no-op. O músico ficaria sem ver o
   * dinheiro que está bloqueado para ele, sem erro nenhum no log. Mesmo desenho
   * de `ConfirmTipPaymentUseCase`.
   */
  uow: IUnitOfWork;
  clock?: IClock;
};

/**
 * O estabelecimento pagou: o dinheiro entrou e ficou **retido** na subconta.
 *
 * ## Espelho, nunca fonte
 *
 * `held_balance` é o reflexo local de um bloqueio que existe na instituição de
 * pagamento. Por isso este use-case só roda a partir da confirmação do PROVEDOR
 * (webhook) — nunca de uma ação da plataforma. Marcar antes de o provedor
 * confirmar anunciaria ao músico um valor que ninguém pagou.
 *
 * ## Ordem: custódia → carteira, e só se mudou
 *
 * O agregado é a fonte da verdade sobre "já contei este pagamento?". Ele vira
 * `held` uma vez só; nas reentregas do webhook, `markHeld` com a mesma
 * referência é no-op e `changed` volta `false` — que é o que impede somar duas
 * vezes ao `held_balance`. Webhook duplicado é o caso NORMAL, não a exceção.
 *
 * 🔴 **`net_amount`, não `amount`.** O músico retém o líquido; a comissão da
 * plataforma nunca entra no espelho dele. Espelhar o bruto ofereceria um saque
 * de dinheiro que não é dele.
 */
export class MarkBookingEscrowHeldUseCase implements IUseCase<
  MarkBookingEscrowHeldInput,
  MarkBookingEscrowHeldOutput
> {
  private readonly clock: IClock;

  constructor(private readonly deps: MarkBookingEscrowHeldDeps) {
    this.clock = deps.clock ?? { now: () => new Date() };
  }

  async execute(
    input: MarkBookingEscrowHeldInput,
  ): Promise<MarkBookingEscrowHeldOutput> {
    return this.deps.uow.do(() => this.markHeld(input));
  }

  private async markHeld(
    input: MarkBookingEscrowHeldInput,
  ): Promise<MarkBookingEscrowHeldOutput> {
    const escrow = await this.deps.escrowRepo.findById(
      new BookingEscrowId(input.escrow_id),
    );
    if (!escrow) {
      throw new NotFoundError(input.escrow_id, BookingEscrow);
    }

    const wasHeld = escrow.status === BookingEscrowStatus.HELD;

    escrow.markHeld({
      external_id: input.external_id,
      expires_at: input.expires_at ?? null,
      at: this.clock.now(),
    });

    if (escrow.notification.hasErrors()) {
      throw new EntityValidationError(escrow.notification.toJSON());
    }

    if (wasHeld) {
      return {
        escrow_id: escrow.escrow_id.id,
        status: escrow.status,
        held_amount: escrow.net_amount.amount,
        changed: false,
      };
    }

    await this.deps.escrowRepo.update(escrow);

    /*
     * Custódia sem músico resolvido não credita ninguém — o valor está retido no
     * provedor de qualquer forma, e o acerto é manual. Nunca cai numa carteira
     * escolhida por conveniência.
     */
    if (escrow.musician_id) {
      const wallet = await this.deps.walletRepo.findByMusicianId(
        escrow.musician_id.id,
      );

      if (wallet) {
        wallet.holdFunds(escrow.net_amount.amount);
        if (wallet.notification.hasErrors()) {
          throw new EntityValidationError(wallet.notification.toJSON());
        }
        await this.deps.walletRepo.update(wallet);
      }
    }

    return {
      escrow_id: escrow.escrow_id.id,
      status: escrow.status,
      held_amount: escrow.net_amount.amount,
      changed: true,
    };
  }
}
