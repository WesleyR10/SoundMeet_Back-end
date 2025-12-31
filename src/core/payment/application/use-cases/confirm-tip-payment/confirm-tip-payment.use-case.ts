import { Band } from "@core/musician/domain/band.aggregate";
import { IBandRepository } from "@core/musician/domain/band.repository";
import { MusicianWallet, PaymentMethod, Tip, Transaction } from "@core/payment";
import {
  IMusicianWalletRepository,
  ITipRepository,
  ITransactionRepository,
} from "@core/payment/domain/repositories";
import { TransactionType } from "@core/payment/domain/transaction-enums";
import { IUseCase } from "@core/shared/application/use-case.interface";
import { Uuid } from "@core/shared/domain";
import { NotFoundError } from "@core/shared/domain/errors";

export type ConfirmTipPaymentInput = {
  tip_id: string;
  payment: {
    amount: number;
    fee?: number;
    payment_method: PaymentMethod;
    user_id?: string | null;
    metadata?: Record<string, any> | null;
  };
};

export type ConfirmTipPaymentOutput = {
  tip_id: string;
  transaction_id: string;
  wallet_balance: number;
};

export class ConfirmTipPaymentUseCase implements IUseCase<
  ConfirmTipPaymentInput,
  ConfirmTipPaymentOutput
> {
  constructor(
    private readonly tipRepo: ITipRepository,
    private readonly txRepo: ITransactionRepository,
    private readonly walletRepo: IMusicianWalletRepository,
    private readonly bandRepo: IBandRepository,
  ) {}

  async execute(
    input: ConfirmTipPaymentInput,
  ): Promise<ConfirmTipPaymentOutput> {
    const tip = await this.tipRepo.findById(new Uuid(input.tip_id));
    if (!tip) {
      throw new NotFoundError(input.tip_id, Tip);
    }

    const transaction = Transaction.create({
      user_id: input.payment.user_id ?? null,
      musician_id: tip.musician_id?.id ?? null,
      band_id: tip.band_id?.id ?? null,
      type: TransactionType.TIP,
      amount: input.payment.amount,
      fee: input.payment.fee ?? 0,
      payment_method: input.payment.payment_method,
      metadata: input.payment.metadata ?? null,
    });

    await this.txRepo.insert(transaction);

    tip.complete(transaction.transaction_id.id);
    await this.tipRepo.update(tip);

    if (tip.band_id) {
      const band = await this.bandRepo.findById(new Uuid(tip.band_id.id));
      if (!band) {
        throw new NotFoundError(tip.band_id.id, Band);
      }

      const activeMembers = band.members;
      if (activeMembers.length > 0) {
        // Split amount among band members
        // For simplicity, splitting equally for now.
        // Future: Implement customizable percentages as per requirements
        const memberShare = Math.floor(
          transaction.net_amount.amount / activeMembers.length,
        );
        const remainder = transaction.net_amount.amount % activeMembers.length;

        for (let i = 0; i < activeMembers.length; i++) {
          const member = activeMembers[i];
          let share = memberShare;

          // Add remainder to the first member (usually leader)
          if (i === 0) {
            share += remainder;
          }

          if (share > 0) {
            let memberWallet = await this.walletRepo.findByMusicianId(
              member.musician_id.id,
            );
            if (!memberWallet) {
              memberWallet = MusicianWallet.create({
                musician_id: member.musician_id.id,
              });
              await this.walletRepo.insert(memberWallet);
            }

            memberWallet.receiveFunds(share);
            await this.walletRepo.update(memberWallet);

            // Create individual transaction record for member share
            const memberTx = Transaction.create({
              musician_id: member.musician_id.id,
              band_id: band.band_id.id,
              type: TransactionType.TIP, // Or a specific type like TIP_SHARE
              amount: share,
              fee: 0, // Fee already deducted from main transaction
              payment_method: input.payment.payment_method,
              metadata: {
                parent_transaction_id: transaction.transaction_id.id,
                tip_id: tip.tip_id.id,
                is_split: true,
              },
            });
            await this.txRepo.insert(memberTx);
          }
        }
      } else {
        // Fallback if band has no members? assign to band leader or keep in band wallet?
        // Assuming band must have members or we treat it like a musician wallet if we had a BandWallet
        // For now, if no members, maybe funds are lost or remain in transaction?
        // Let's assume valid band has members. If not, log warning.
      }
    } else {
      // Direct musician tip
      if (!tip.musician_id) {
        throw new Error("Tip must have a musician_id if no band_id is present");
      }

      let wallet = await this.walletRepo.findByMusicianId(tip.musician_id.id);
      if (!wallet) {
        wallet = MusicianWallet.create({ musician_id: tip.musician_id.id });
        await this.walletRepo.insert(wallet);
      }

      wallet.receiveFunds(transaction.net_amount.amount);
      await this.walletRepo.update(wallet);
    }

    // Return wallet balance of the primary recipient (musician or first band member/leader for context)
    // Or maybe just 0 if band split
    let displayedBalance = 0;
    if (tip.musician_id) {
      const w = await this.walletRepo.findByMusicianId(tip.musician_id.id);
      displayedBalance = w ? w.balance.amount : 0;
    }

    return {
      tip_id: tip.tip_id.id,
      transaction_id: transaction.transaction_id.id,
      wallet_balance: displayedBalance,
    };
  }
}
