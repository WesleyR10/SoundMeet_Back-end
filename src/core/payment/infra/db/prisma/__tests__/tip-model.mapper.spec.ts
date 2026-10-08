import { CurrencyEnum, TipStatus as PrismaTipStatus } from "@prisma/client";

import { FakeEncryptionService } from "../../../../../shared/infra/crypto/fake-encryption.service";
import { Tip } from "../../../../domain/tip.aggregate";
import { TipModelMapper, TipModelProps } from "../tip-model.mapper";

describe("TipModelMapper (SM-016 field encryption)", () => {
  let encryption: FakeEncryptionService;
  let mapper: TipModelMapper;

  beforeEach(() => {
    encryption = new FakeEncryptionService();
    mapper = new TipModelMapper(encryption);
  });

  function baseModel(overrides: Partial<TipModelProps> = {}): any {
    return {
      id: "11111111-1111-4111-8111-111111111111",
      audienceId: "22222222-2222-4222-8222-222222222222",
      musicianId: null,
      bandId: null,
      eventId: null,
      amount: "10.00",
      currency: CurrencyEnum.BRL,
      message: null,
      paymentMethod: "pix",
      status: PrismaTipStatus.pending,
      transactionId: null,
      pixKey: null,
      pixKeyCiphertext: null,
      pixKeyIv: null,
      pixKeyAuthTag: null,
      pixKeyType: null,
      isAnonymous: false,
      showInWall: true,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  it("nunca escreve a pix key em claro na coluna legada", () => {
    const tip = Tip.create({
      audience_id: "22222222-2222-4222-8222-222222222222",
      amount: 10,
      payment_method: "pix" as any,
      pix_key: { key: "musico@pix.com", type: "email" },
    });

    const model = mapper.toModel(tip);

    expect(model.pixKey).toBeNull();
    expect(model.pixKeyCiphertext).not.toBeNull();
    expect(model.pixKeyCiphertext).not.toContain("musico@pix.com");
    expect(model.pixKeyIv).not.toBeNull();
    expect(model.pixKeyAuthTag).not.toBeNull();
    expect(model.pixKeyType).toBe("email");
  });

  it("faz round-trip: cifra em toModel e decifra em toEntity", () => {
    const tip = Tip.create({
      audience_id: "22222222-2222-4222-8222-222222222222",
      amount: 10,
      payment_method: "pix" as any,
      pix_key: { key: "musico@pix.com", type: "email" },
    });

    const model = mapper.toModel(tip);
    const restored = mapper.toEntity(baseModel(model));

    expect(restored.pix_key?.key).toBe("musico@pix.com");
    expect(restored.pix_key?.type).toBe("email");
  });

  it("cai no fallback da coluna legada quando não há cifra (linha pré-backfill)", () => {
    const model = baseModel({ pixKey: "legado@pix.com", pixKeyType: "email" });

    const restored = mapper.toEntity(model);

    expect(restored.pix_key?.key).toBe("legado@pix.com");
  });

  it("prefere a coluna cifrada quando ambas existem", () => {
    const encrypted = encryption.encrypt("novo@pix.com");
    const model = baseModel({
      pixKey: "legado-nao-deveria-ser-usado@pix.com",
      pixKeyCiphertext: encrypted.ciphertext,
      pixKeyIv: encrypted.iv,
      pixKeyAuthTag: encrypted.authTag,
      pixKeyType: "email",
    });

    const restored = mapper.toEntity(model);

    expect(restored.pix_key?.key).toBe("novo@pix.com");
  });

  it("não tenta cifrar/decifrar quando não há pix key", () => {
    const tip = Tip.create({
      audience_id: "22222222-2222-4222-8222-222222222222",
      amount: 10,
      payment_method: "pix" as any,
    });

    const model = mapper.toModel(tip);
    expect(model.pixKeyCiphertext).toBeNull();

    const restored = mapper.toEntity(baseModel(model));
    expect(restored.pix_key).toBeNull();
  });
});
