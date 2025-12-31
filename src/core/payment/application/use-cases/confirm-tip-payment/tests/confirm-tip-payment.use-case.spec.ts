import "reflect-metadata";

import { Band } from "@core/musician/domain/band.aggregate";
import { IBandRepository } from "@core/musician/domain/band.repository";
import {
  MusicianWallet,
  PaymentMethod,
  Tip,
  TipInMemoryRepository,
  TransactionInMemoryRepository,
} from "@core/payment";
import { IMusicianWalletRepository } from "@core/payment/domain/repositories/musician-wallet.repository";

import { ConfirmTipPaymentUseCase } from "../confirm-tip-payment.use-case";

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
  async delete(): Promise<void> {
    /* not used */
  }
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
  async search(): Promise<any> {
    return {
      items: this.items,
      total: this.items.length,
      current_page: 1,
      per_page: 10,
    };
  }
}

class BandRepoStub implements IBandRepository {
  sortableFields: string[] = ["name"];
  items: Band[] = [];
  async insert(entity: Band): Promise<void> {
    this.items.push(entity);
  }
  async bulkInsert(entities: Band[]): Promise<void> {
    this.items.push(...entities);
  }
  async update(entity: Band): Promise<void> {
    const i = this.items.findIndex((b) => b.band_id.equals(entity.band_id));
    if (i !== -1) this.items[i] = entity;
  }
  async delete(): Promise<void> {
    /* not used */
  }
  async findById(id: any): Promise<Band | null> {
    const _id = typeof id === "string" ? id : id.id;
    return this.items.find((b) => b.band_id.id === _id) || null;
  }
  async findAll(): Promise<Band[]> {
    return this.items;
  }
  async findByIds(): Promise<Band[]> {
    return [];
  }
  async existsById(): Promise<{ exists: any[]; not_exists: any[] }> {
    return { exists: [], not_exists: [] };
  }
  getEntity(): new (...args: any[]) => Band {
    return Band;
  }
  async search(): Promise<any> {
    return {
      items: this.items,
      total: this.items.length,
      current_page: 1,
      per_page: 10,
    };
  }
}

describe("ConfirmTipPaymentUseCase", () => {
  it("should create transaction, complete tip and credit wallet", async () => {
    const tipRepo = new TipInMemoryRepository();
    const txRepo = new TransactionInMemoryRepository();
    const walletRepo = new MusicianWalletRepoStub();
    const bandRepo = new BandRepoStub();
    const useCase = new ConfirmTipPaymentUseCase(
      tipRepo,
      txRepo,
      walletRepo,
      bandRepo,
    );

    const tip = Tip.create({
      audience_id: "123e4567-e89b-12d3-a456-426614174000",
      musician_id: "123e4567-e89b-12d3-a456-426614174001",
      amount: 100,
      payment_method: PaymentMethod.PIX,
    });
    await tipRepo.insert(tip);

    const output = await useCase.execute({
      tip_id: tip.tip_id.id,
      payment: { amount: 100, fee: 3, payment_method: PaymentMethod.PIX },
    });

    expect(output.tip_id).toBe(tip.tip_id.id);
    expect(output.transaction_id).toBeDefined();
    expect(output.wallet_balance).toBe(97);
  });
});
