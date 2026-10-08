import { InvalidArgumentError } from "../../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { UnitOfWorkFakeInMemory } from "../../../../../shared/infra/db/in-memory/fake-unit-of-work-in-memory";
import { MusicianWallet } from "../../../../domain/musician-wallet.aggregate";
import { PaymentMethod } from "../../../../domain/tip-enums";
import { Transaction } from "../../../../domain/transaction.aggregate";
import {
  TransactionStatus,
  TransactionType,
} from "../../../../domain/transaction-enums";
import { MusicianWalletInMemoryRepository } from "../../../../infra/db/in-memory/musician-wallet-in-memory.repository";
import { TransactionInMemoryRepository } from "../../../../infra/db/in-memory/transaction-in-memory.repository";
import { RefundFailedWithdrawUseCase } from "../refund-failed-withdraw.use-case";

const MUSICIAN_ID = "123e4567-e89b-12d3-a456-426614174001";

async function buildHarness(options?: {
  type?: TransactionType;
  status?: TransactionStatus;
}) {
  const txRepo = new TransactionInMemoryRepository();
  const walletRepo = new MusicianWalletInMemoryRepository();
  const uow = new UnitOfWorkFakeInMemory();

  const wallet = MusicianWallet.create({ musician_id: MUSICIAN_ID });
  wallet.receiveFunds(200);
  wallet.withdrawFunds(110); // o débito que a reserva do saque já fez
  await walletRepo.insert(wallet);

  const transaction = Transaction.create({
    musician_id: MUSICIAN_ID,
    type: options?.type ?? TransactionType.WITHDRAWAL,
    amount: 110,
    fee: 0,
    payment_method: PaymentMethod.PIX,
    metadata: { kind: "withdraw" },
  });
  if (options?.status === TransactionStatus.COMPLETED) {
    transaction.complete();
  }
  await txRepo.insert(transaction);

  const useCase = new RefundFailedWithdrawUseCase(txRepo, walletRepo, uow);
  return { useCase, txRepo, walletRepo, transaction };
}

const walletOf = async (h: { walletRepo: MusicianWalletInMemoryRepository }) =>
  (await h.walletRepo.findByMusicianId(MUSICIAN_ID))!;

describe("RefundFailedWithdrawUseCase", () => {
  it("devolve o saldo e reverte total_withdrawn", async () => {
    const h = await buildHarness();

    const before = await walletOf(h);
    expect(before.balance.amount).toBe(90);
    expect(before.total_withdrawn.amount).toBe(110);

    const result = await h.useCase.execute({
      transaction_id: h.transaction.transaction_id.id,
      reason: "Chave PIX inválida",
    });

    expect(result.changed).toBe(true);
    const after = await walletOf(h);
    expect(after.balance.amount).toBe(200);
    expect(after.total_withdrawn.amount).toBe(0);

    const tx = (await h.txRepo.findById(h.transaction.transaction_id))!;
    expect(tx.status).toBe(TransactionStatus.FAILED);
    expect(tx.metadata?.failure_reason).toBe("Chave PIX inválida");
  });

  /**
   * O caso que o webhook produz o tempo todo: TRANSFER_FAILED reentregue.
   * Creditar de novo seria dar ao músico o dobro do saque que nem saiu.
   */
  it("reentrega do mesmo estorno é no-op — não credita duas vezes", async () => {
    const h = await buildHarness();

    await h.useCase.execute({
      transaction_id: h.transaction.transaction_id.id,
    });
    const second = await h.useCase.execute({
      transaction_id: h.transaction.transaction_id.id,
    });

    expect(second.changed).toBe(false);
    expect((await walletOf(h)).balance.amount).toBe(200);
  });

  it("estornos concorrentes da mesma transação creditam uma vez só", async () => {
    const h = await buildHarness();

    const results = await Promise.all([
      h.useCase.execute({ transaction_id: h.transaction.transaction_id.id }),
      h.useCase.execute({ transaction_id: h.transaction.transaction_id.id }),
    ]);

    expect(results.filter((r) => r.changed)).toHaveLength(1);
    expect((await walletOf(h)).balance.amount).toBe(200);
  });

  /**
   * TRANSFER_DONE chegou primeiro e a transferência concluiu. Um
   * TRANSFER_FAILED atrasado não pode desfazer um saque que já saiu — devolveria
   * saldo sacável de dinheiro que já está na conta do músico.
   */
  it("transação já concluída não é estornada", async () => {
    const h = await buildHarness({ status: TransactionStatus.COMPLETED });

    const result = await h.useCase.execute({
      transaction_id: h.transaction.transaction_id.id,
    });

    expect(result.changed).toBe(false);
    expect((await walletOf(h)).balance.amount).toBe(90);
  });

  it("recusa estornar uma transação que não é saque", async () => {
    const h = await buildHarness({ type: TransactionType.TIP });

    await expect(
      h.useCase.execute({ transaction_id: h.transaction.transaction_id.id }),
    ).rejects.toThrow(InvalidArgumentError);
    expect((await walletOf(h)).balance.amount).toBe(90);
  });

  it("transação inexistente lança NotFoundError", async () => {
    const h = await buildHarness();

    await expect(
      h.useCase.execute({
        transaction_id: "99999999-9999-4999-8999-999999999999",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
