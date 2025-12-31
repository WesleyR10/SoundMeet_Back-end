import {
  PaymentMethod,
  Tip,
  TipInMemoryRepository,
  TipStatus,
} from "@core/payment";
import { Money, Uuid } from "@core/shared/domain/value-objects";

import { GetMusicianTipsUseCase } from "../get-musician-tips.use-case";

describe("GetMusicianTipsUseCase Unit Tests", () => {
  let useCase: GetMusicianTipsUseCase;
  let repository: TipInMemoryRepository;

  beforeEach(() => {
    repository = new TipInMemoryRepository();
    useCase = new GetMusicianTipsUseCase(repository);
  });

  it("should return tips for a musician", async () => {
    const musicianId = new Uuid();
    const audienceId = new Uuid();
    const tips = [
      new Tip({
        audience_id: audienceId,
        musician_id: musicianId,
        amount: new Money(10),
        payment_method: PaymentMethod.PIX,
        status: TipStatus.COMPLETED,
      }),
      new Tip({
        audience_id: audienceId,
        musician_id: musicianId,
        amount: new Money(20),
        payment_method: PaymentMethod.CREDIT_CARD,
        status: TipStatus.PENDING,
      }),
      new Tip({
        audience_id: audienceId,
        musician_id: new Uuid(), // Another musician
        amount: new Money(30),
        payment_method: PaymentMethod.PIX,
      }),
    ];

    await repository.bulkInsert(tips);

    const output = await useCase.execute({
      musician_id: musicianId.id,
      page: 1,
      per_page: 10,
      sort: "created_at",
      sort_dir: "desc",
    });

    expect(output.items).toHaveLength(2);
    expect(output.total).toBe(2);
    expect(output.items[0].musician_id).toBe(musicianId.id);
    expect(output.items[1].musician_id).toBe(musicianId.id);
  });

  it("should return empty list if musician has no tips", async () => {
    const output = await useCase.execute({
      musician_id: new Uuid().id,
      page: 1,
      per_page: 10,
    });

    expect(output.items).toHaveLength(0);
    expect(output.total).toBe(0);
  });
});
