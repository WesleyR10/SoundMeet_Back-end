import { Tip } from "../tip.entity";
import { PaymentMethod, TipStatus } from "../tip-enums";

describe("Tip Aggregate", () => {
  it("should create and validate", () => {
    const tip = Tip.create({
      audience_id: "123e4567-e89b-12d3-a456-426614174000",
      musician_id: "123e4567-e89b-12d3-a456-426614174001",
      amount: 10,
      payment_method: PaymentMethod.PIX,
    });
    expect(tip.status).toBe(TipStatus.PENDING);
    expect(tip.amount.amount).toBe(10);
  });

  it("should complete and emit event", () => {
    const tip = Tip.create({
      audience_id: "123e4567-e89b-12d3-a456-426614174000",
      musician_id: "123e4567-e89b-12d3-a456-426614174001",
      amount: 5,
      payment_method: PaymentMethod.PIX,
    });
    tip.complete("tx-1");
    expect(tip.status).toBe(TipStatus.COMPLETED);
    expect(tip.transaction_id).toBe("tx-1");
    expect(tip.getUncommittedEvents().length).toBeGreaterThan(0);
  });

  it("should fail and emit event", () => {
    const tip = Tip.create({
      audience_id: "123e4567-e89b-12d3-a456-426614174000",
      musician_id: "123e4567-e89b-12d3-a456-426614174001",
      amount: 5,
      payment_method: PaymentMethod.PIX,
    });
    tip.fail();
    expect(tip.status).toBe(TipStatus.FAILED);
    expect(tip.getUncommittedEvents().length).toBeGreaterThan(0);
  });
});
