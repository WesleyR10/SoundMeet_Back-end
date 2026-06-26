import {
  IMusicianWalletRepository,
  MusicianWallet,
  TransactionInMemoryRepository,
} from "@core/payment";

import { MusicianPlanTier } from "../../../../../plans/domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../../plans/domain/subscription.aggregate";
import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { SubscriptionInMemoryRepository } from "../../../../../plans/infra/db/in-memory/subscription-in-memory.repository";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { WithdrawToPixUseCase } from "../withdraw-to-pix.use-case";

class MusicianWalletRepoStub implements IMusicianWalletRepository {
  sortableFields: string[] = ["created_at"];
  items: MusicianWallet[] = [];
  async insert(entity: MusicianWallet): Promise<void> {
    this.items.push(entity);
  }
  async bulkInsert(entities: MusicianWallet[]): Promise<void> {
    this.items.push(...entities);
  }
  async update(entity: MusicianWallet): Promise<void> {
    const i = this.items.findIndex((w) => w.wallet_id.equals(entity.wallet_id));
    if (i !== -1) this.items[i] = entity;
  }
  async delete(): Promise<void> {}
  async findById(): Promise<MusicianWallet | null> {
    return null;
  }
  async findAll(): Promise<MusicianWallet[]> {
    return this.items;
  }
  async findByIds(): Promise<MusicianWallet[]> {
    return [];
  }
  async existsById(): Promise<{ exists: any[]; not_exists: any[] }> {
    return { exists: [], not_exists: [] };
  }
  getEntity(): new (...args: any[]) => MusicianWallet {
    return MusicianWallet;
  }
  async findByMusicianId(musicianId: string): Promise<MusicianWallet | null> {
    return this.items.find((w) => w.musician_id.id === musicianId) ?? null;
  }
  async search(props: any): Promise<any> {
    return {
      items: this.items,
      total: this.items.length,
      current_page: 1,
      per_page: 10,
    };
  }
}

describe("WithdrawToPixUseCase", () => {
  it("should withdraw funds and create transaction", async () => {
    const txRepo = new TransactionInMemoryRepository();
    const walletRepo = new MusicianWalletRepoStub();
    const useCase = new WithdrawToPixUseCase(walletRepo, txRepo);

    const wallet = MusicianWallet.create({
      musician_id: "123e4567-e89b-12d3-a456-426614174001",
    });
    wallet.receiveFunds(200);
    await walletRepo.insert(wallet);

    const output = await useCase.execute({
      musician_id: "123e4567-e89b-12d3-a456-426614174001",
      amount: 110,
      pix_key: { key: "12345678909", type: "cpf" },
    });
    expect(output.wallet_balance).toBe(90);
    expect(output.transaction_id).toBeDefined();
  });
});

// ----------------------------------------------------------------
// Gate 4C.2 — min_withdrawal_amount_brl por plano
// ----------------------------------------------------------------
describe("WithdrawToPixUseCase — gate 4C.2 (withdrawal config por plano)", () => {
  const MUSICIAN_ID = "123e4567-e89b-12d3-a456-426614174099";

  function makeWallet(balance = 200) {
    const wallet = MusicianWallet.create({ musician_id: MUSICIAN_ID });
    wallet.receiveFunds(balance);
    return wallet;
  }

  async function setup(tier?: MusicianPlanTier, walletBalance = 200) {
    const txRepo = new TransactionInMemoryRepository();
    const walletRepo = new MusicianWalletRepoStub();
    const subRepo = new SubscriptionInMemoryRepository();

    const wallet = makeWallet(walletBalance);
    await walletRepo.insert(wallet);

    if (tier) {
      await subRepo.insert(
        new Subscription({
          musician_id: MUSICIAN_ID,
          plan_tier: tier,
          persona: "musician",
          status: SubscriptionStatus.ACTIVE,
        }),
      );
    }

    const planCheckService = new PlanCheckService(subRepo);
    const useCase = new WithdrawToPixUseCase(walletRepo, txRepo, undefined, planCheckService);
    return { useCase };
  }

  const pix_key = { key: "12345678909", type: "cpf" } as const;

  it("FREE: mínimo R$110 — R$100 lança EntityValidationError", async () => {
    const { useCase } = await setup();
    await expect(
      useCase.execute({ musician_id: MUSICIAN_ID, amount: 100, pix_key }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("FREE: mínimo R$110 — R$109 lança EntityValidationError", async () => {
    const { useCase } = await setup(undefined, 500);
    await expect(
      useCase.execute({ musician_id: MUSICIAN_ID, amount: 109, pix_key }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("ESSENTIAL: mínimo R$70 — R$60 lança EntityValidationError", async () => {
    const { useCase } = await setup(MusicianPlanTier.ESSENTIAL, 200);
    await expect(
      useCase.execute({ musician_id: MUSICIAN_ID, amount: 60, pix_key }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("ESSENTIAL: mínimo R$70 — R$70 valida mínimo corretamente", async () => {
    const { useCase } = await setup(MusicianPlanTier.ESSENTIAL, 200);
    await expect(
      useCase.execute({ musician_id: MUSICIAN_ID, amount: 70, pix_key }),
    ).resolves.not.toThrow();
  });

  it("PRO: mínimo R$50 — R$40 lança EntityValidationError", async () => {
    const { useCase } = await setup(MusicianPlanTier.PRO, 200);
    await expect(
      useCase.execute({ musician_id: MUSICIAN_ID, amount: 40, pix_key }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("PRO: mínimo R$50 — R$50 valida mínimo corretamente", async () => {
    const { useCase } = await setup(MusicianPlanTier.PRO, 200);
    await expect(
      useCase.execute({ musician_id: MUSICIAN_ID, amount: 50, pix_key }),
    ).resolves.not.toThrow();
  });
});
