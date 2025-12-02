import { PaymentMethod, Transaction, TransactionInMemoryRepository } from "@core/payment";
import { GetMusicianTransactionsUseCase } from "../get-musician-transactions.use-case";
import { TransactionType } from "@core/payment/domain/transaction-enums";

describe("GetMusicianTransactionsUseCase", () => {
  it("should paginate musician transactions", async () => {
    const txRepo = new TransactionInMemoryRepository();
    const useCase = new GetMusicianTransactionsUseCase(txRepo);

    const t1 = Transaction.create({ musician_id: "123e4567-e89b-12d3-a456-426614174001", type: TransactionType.TIP, amount: 100, payment_method: PaymentMethod.PIX });
    const t2 = Transaction.create({ musician_id: "123e4567-e89b-12d3-a456-426614174001", type: TransactionType.TIP, amount: 50, payment_method: PaymentMethod.PIX });
    await txRepo.bulkInsert([t1, t2]);

    const output = await useCase.execute({ musician_id: "m-1", page: 1, per_page: 2 });
    expect(output.items.length).toBe(2);
    expect(output.total).toBe(2);
  });
});
