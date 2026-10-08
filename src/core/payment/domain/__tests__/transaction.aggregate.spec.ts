import { PaymentMethod } from "../tip-enums";
import { Transaction } from "../transaction.aggregate";
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

  /*
   * 🔴 Regressão: `net_amount` era `command.amount - command.fee` em ponto
   * flutuante. Um cachê de R$1.111,10 com 10% de comissão dava
   * `999.9899999999999`, o `Money` recusava mais de duas casas e a transação
   * nascia inválida — a confirmação do pagamento falhava com o dinheiro já
   * aprovado no gateway.
   */
  it.each([
    [1111.1, 111.11, 999.99],
    [20, 1.8, 18.2],
    [333.33, 33.33, 300],
    [0.3, 0.1, 0.2],
  ])(
    "net_amount de %p menos taxa %p é %p, em centavos",
    (amount, fee, expected) => {
      const tx = Transaction.create({
        type: TransactionType.TIP,
        amount,
        fee,
        payment_method: PaymentMethod.PIX,
      });

      expect(tx.net_amount.amount).toBe(expected);
      // A invariante que o ledger precisa: nada criado, nada perdido.
      expect(tx.net_amount.cents + tx.fee.cents).toBe(tx.amount.cents);
    },
  );

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
