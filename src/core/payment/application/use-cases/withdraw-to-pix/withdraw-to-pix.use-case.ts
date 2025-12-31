import { MusicianWallet, PaymentMethod, Transaction } from "@core/payment";
import {
  IMusicianWalletRepository,
  ITransactionRepository,
} from "@core/payment/domain/repositories";
import { TransactionType } from "@core/payment/domain/transaction-enums";
import { IUseCase } from "@core/shared/application/use-case.interface";
import { NotFoundError } from "@core/shared/domain/errors";

export type WithdrawToPixInput = {
  musician_id: string;
  amount: number;
  pix_key: { key: string; type: string };
};

export type WithdrawToPixOutput = {
  transaction_id: string;
  wallet_balance: number;
  status: string;
};

export class WithdrawToPixUseCase implements IUseCase<
  WithdrawToPixInput,
  WithdrawToPixOutput
> {
  constructor(
    private readonly walletRepo: IMusicianWalletRepository,
    private readonly txRepo: ITransactionRepository,
  ) {}

  async execute(input: WithdrawToPixInput): Promise<WithdrawToPixOutput> {
    const wallet = await this.walletRepo.findByMusicianId(input.musician_id);
    if (!wallet) {
      throw new NotFoundError(input.musician_id, MusicianWallet);
    }

    wallet.updatePixKey(input.pix_key.key, input.pix_key.type);
    wallet.withdrawFunds(input.amount);
    await this.walletRepo.update(wallet);

    const tx = Transaction.create({
      musician_id: input.musician_id,
      type: TransactionType.WITHDRAWAL,
      amount: input.amount,
      fee: 0,
      payment_method: PaymentMethod.PIX,
      metadata: { kind: "withdraw" },
    });

    tx.complete();
    await this.txRepo.insert(tx);

    return {
      transaction_id: tx.transaction_id.id,
      wallet_balance: wallet.balance.amount,
      status: tx.status,
    };
  }
}
