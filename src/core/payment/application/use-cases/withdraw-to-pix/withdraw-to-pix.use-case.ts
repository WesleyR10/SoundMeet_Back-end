import { MusicianWallet, PaymentMethod, Transaction } from "@core/payment";
import {
  IMusicianWalletRepository,
  ITransactionRepository,
} from "@core/payment/domain/repositories";
import { TransactionType } from "@core/payment/domain/transaction-enums";
import { IPixWithdrawGateway } from "@core/payment/infra/gateways/pix-withdraw-gateway.interface";
import { IUseCase } from "@core/shared/application/use-case.interface";
import { NotFoundError } from "@core/shared/domain/errors";
import { EntityValidationError } from "@core/shared/domain/validators/validation.error";

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
    private readonly pixWithdrawGateway?: IPixWithdrawGateway,
  ) {}

  async execute(input: WithdrawToPixInput): Promise<WithdrawToPixOutput> {
    const wallet = await this.walletRepo.findByMusicianId(input.musician_id);
    if (!wallet) {
      throw new NotFoundError(input.musician_id, MusicianWallet);
    }

    wallet.updatePixKey(input.pix_key.key, input.pix_key.type);
    wallet.withdrawFunds(input.amount);

    if (wallet.notification.hasErrors()) {
      throw new EntityValidationError(wallet.notification.toJSON());
    }

    const tx = Transaction.create({
      musician_id: input.musician_id,
      type: TransactionType.WITHDRAWAL,
      amount: input.amount,
      fee: 0,
      payment_method: PaymentMethod.PIX,
      metadata: { kind: "withdraw" },
    });

    if (this.pixWithdrawGateway) {
      const result = await this.pixWithdrawGateway.withdraw({
        amount: input.amount,
        pix_key: input.pix_key.key,
        pix_key_type: input.pix_key.type,
        description: "Saque SoundMeet",
        external_reference: tx.transaction_id.id,
      });
      tx.external_id = result.transfer_id;
      // Transaction fica PENDING — completed quando webhook TRANSFER_DONE chegar
    } else {
      tx.complete();
    }

    await this.walletRepo.update(wallet);
    await this.txRepo.insert(tx);

    return {
      transaction_id: tx.transaction_id.id,
      wallet_balance: wallet.balance.amount,
      status: tx.status,
    };
  }
}
