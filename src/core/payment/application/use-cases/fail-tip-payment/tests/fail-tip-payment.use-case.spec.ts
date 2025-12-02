import { PaymentMethod, Tip, TipInMemoryRepository, TipStatus } from "@core/payment";
import { FailTipPaymentUseCase } from "../fail-tip-payment.use-case";


describe("FailTipPaymentUseCase", () => {
  it("should mark tip as failed", async () => {
    const tipRepo = new TipInMemoryRepository();
    const useCase = new FailTipPaymentUseCase(tipRepo);

    const tip = Tip.create({
      audience_id: "123e4567-e89b-12d3-a456-426614174000",
      musician_id: "123e4567-e89b-12d3-a456-426614174001",
      amount: 50,
      payment_method: PaymentMethod.PIX,
    });
    await tipRepo.insert(tip);

    const output = await useCase.execute({ tip_id: tip.tip_id.id, reason: "gateway error" });
    expect(output.status).toBe(TipStatus.FAILED);
  });
});
