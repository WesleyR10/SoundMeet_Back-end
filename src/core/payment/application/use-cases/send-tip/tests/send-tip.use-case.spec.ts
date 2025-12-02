import { PaymentMethod, TipInMemoryRepository, TipStatus } from "@core/payment";
import { SendTipUseCase } from "../send-tip.use-case";
import { PixKeyType } from "@core/payment/domain/value-objects/pix-key.vo";

describe("SendTipUseCase Unit Tests", () => {
  let useCase: SendTipUseCase;
  let repository: TipInMemoryRepository;

  beforeEach(() => {
    repository = new TipInMemoryRepository();
    useCase = new SendTipUseCase(repository);
  });

  it("should create a tip with PIX payment method", async () => {
    const output = await useCase.execute({
      audience_id: "123e4567-e89b-12d3-a456-426614174000",
      musician_id: "123e4567-e89b-12d3-a456-426614174001",
      amount: 10.0,
      payment_method: PaymentMethod.PIX,
      message: "Great show!",
      pix_key: {
        key: "12345678909",
        type: PixKeyType.CPF,
      },
    });

    expect(output.id).toBeDefined();
    expect(output.status).toBe(TipStatus.PENDING);
    expect(output.qr_code).toBeDefined();
    expect(output.copy_paste_code).toBeDefined();

    const Uuid = (await import("@core/shared/domain/value-objects/uuid.vo")).Uuid;
    const tip = await repository.findById(new Uuid(output.id));
    
    expect(tip).toBeDefined();
    expect(tip?.amount.amount).toBe(10.0);
    expect(tip?.message).toBe("Great show!");
  });

  it("should create an anonymous tip", async () => {
    const output = await useCase.execute({
      audience_id: "123e4567-e89b-12d3-a456-426614174000",
      musician_id: "123e4567-e89b-12d3-a456-426614174001",
      amount: 50.0,
      payment_method: PaymentMethod.CREDIT_CARD,
      is_anonymous: true,
    });

    const Uuid = (await import("@core/shared/domain/value-objects/uuid.vo")).Uuid;
    const tip = await repository.findById(new Uuid(output.id));

    expect(tip?.is_anonymous).toBe(true);
  });
});
