import { PaymentMethod } from "../tip-enums";
import { Transaction } from "../transaction.entity";
import { TransactionStatus, TransactionType } from "../transaction-enums";

describe("Transaction Aggregate", () => {
  it("should create with net amount calculated and emit event", () => {
    const tx = Transaction.create({
      type: TransactionType.TIP,
      amount: 100,
      fee: 3,
      payment_method: PaymentMethod.PIX,
    });
    expect(tx.net_amount.amount).toBe(97);
    expect(tx.status).toBe(TransactionStatus.PENDING);
    expect(tx.getUncommittedEvents().length).toBeGreaterThan(0);
  });

  it("should complete and fail transitions", () => {
    const tx = Transaction.create({
      type: TransactionType.TIP,
      amount: 50,
      payment_method: PaymentMethod.PIX,
    });
    tx.complete();
    expect(tx.status).toBe(TransactionStatus.COMPLETED);
    tx.fail();
    expect(tx.status).toBe(TransactionStatus.FAILED);
  });
});
