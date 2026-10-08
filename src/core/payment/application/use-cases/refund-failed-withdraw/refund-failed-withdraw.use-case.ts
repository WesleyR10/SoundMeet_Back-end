import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { IUnitOfWork } from "../../../../shared/domain/repository/unit-of-work.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  IMusicianWalletRepository,
  ITransactionRepository,
} from "../../../domain/repositories";
import {
  Transaction,
  TransactionId,
} from "../../../domain/transaction.aggregate";
import {
  TransactionStatus,
  TransactionType,
} from "../../../domain/transaction-enums";

export type RefundFailedWithdrawInput = {
  transaction_id: string;
  /** Registrado em `metadata.failure_reason` do lançamento. */
  reason?: string | null;
};

export type RefundFailedWithdrawOutput = {
  transaction_id: string;
  /** `false` quando a transação já não estava pendente — reentrega é o normal. */
  changed: boolean;
  wallet_balance: number | null;
};

/**
 * O saque não saiu: a transação vira `failed` e o valor volta a ser sacável.
 *
 * 🔴 Sem isto, `TRANSFER_FAILED` marcava a transação como falha e **deixava o
 * saldo debitado** — o provedor recusava a transferência, o dinheiro não caía
 * na conta do músico e também não voltava para a carteira dele. Sumia, sem
 * erro visível em lugar nenhum, e a única pista era um lançamento `failed` que
 * ninguém correlaciona com o saldo.
 *
 * ## Por que a carteira é travada ANTES de decidir
 *
 * A reentrega do webhook e o caminho de recusa do próprio `WithdrawToPixUseCase`
 * podem chegar aqui ao mesmo tempo para a mesma transferência. Ler o status,
 * decidir estornar e só então travar deixaria as duas execuções passando pela
 * checagem de `pending` antes de qualquer uma escrever — creditando o valor
 * duas vezes. O lock da carteira vem primeiro e a transação é **relida dentro
 * dele**: quem chega depois lê `failed` e sai como no-op.
 *
 * O tipo é conferido de propósito: este use-case devolve dinheiro a `balance`,
 * e apontá-lo para uma gorjeta ou uma comissão creditaria saldo sacável de um
 * lançamento que nunca debitou nada.
 */
export class RefundFailedWithdrawUseCase implements IUseCase<
  RefundFailedWithdrawInput,
  RefundFailedWithdrawOutput
> {
  constructor(
    private readonly txRepo: ITransactionRepository,
    private readonly walletRepo: IMusicianWalletRepository,
    private readonly uow: IUnitOfWork,
  ) {}

  async execute(
    input: RefundFailedWithdrawInput,
  ): Promise<RefundFailedWithdrawOutput> {
    return this.uow.do(async () => {
      const transactionId = new TransactionId(input.transaction_id);

      const preview = await this.txRepo.findById(transactionId);
      if (!preview) {
        throw new NotFoundError(input.transaction_id, Transaction);
      }
      if (preview.type !== TransactionType.WITHDRAWAL) {
        throw new InvalidArgumentError(
          `Estorno de saque não se aplica a uma transação ${preview.type}`,
        );
      }

      /*
       * Saque sem músico não tem carteira para creditar. Não é um caso
       * esperado — `WithdrawToPixUseCase` sempre preenche o `musician_id` —,
       * mas marcar a transação e seguir é melhor que falhar o webhook em
       * loop por um dado que ninguém vai corrigir sozinho.
       */
      if (!preview.musician_id) {
        if (preview.status !== TransactionStatus.PENDING) {
          return this.unchanged(preview.transaction_id.id);
        }
        preview.fail(input.reason ?? undefined);
        await this.txRepo.update(preview);
        return {
          transaction_id: preview.transaction_id.id,
          changed: true,
          wallet_balance: null,
        };
      }

      const wallet = await this.walletRepo.findByMusicianIdForUpdate(
        preview.musician_id.id,
      );

      // Releitura sob o lock: é esta que decide, não a de cima.
      const tx = await this.txRepo.findById(transactionId);
      if (!tx || tx.status !== TransactionStatus.PENDING) {
        return {
          transaction_id: input.transaction_id,
          changed: false,
          wallet_balance: wallet?.balance.amount ?? null,
        };
      }

      tx.fail(input.reason ?? undefined);
      await this.txRepo.update(tx);

      if (!wallet) {
        return {
          transaction_id: tx.transaction_id.id,
          changed: true,
          wallet_balance: null,
        };
      }

      wallet.refundWithdrawal(tx.amount.amount);
      if (wallet.notification.hasErrors()) {
        throw new EntityValidationError(wallet.notification.toJSON());
      }
      await this.walletRepo.update(wallet);

      return {
        transaction_id: tx.transaction_id.id,
        changed: true,
        wallet_balance: wallet.balance.amount,
      };
    });
  }

  private unchanged(transactionId: string): RefundFailedWithdrawOutput {
    return {
      transaction_id: transactionId,
      changed: false,
      wallet_balance: null,
    };
  }
}
