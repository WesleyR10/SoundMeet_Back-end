import { IMusicianWalletRepository, MusicianWallet, TransactionInMemoryRepository } from "@core/payment";
import { WithdrawToPixUseCase } from "../withdraw-to-pix.use-case";

class MusicianWalletRepoStub implements IMusicianWalletRepository {
  sortableFields: string[] = ["created_at"];
  items: MusicianWallet[] = [];
  async insert(entity: MusicianWallet): Promise<void> { this.items.push(entity); }
  async bulkInsert(entities: MusicianWallet[]): Promise<void> { this.items.push(...entities); }
  async update(entity: MusicianWallet): Promise<void> { const i = this.items.findIndex(w => w.wallet_id.equals(entity.wallet_id)); if (i !== -1) this.items[i] = entity; }
  async delete(): Promise<void> {}
  async findById(): Promise<MusicianWallet | null> { return null; }
  async findAll(): Promise<MusicianWallet[]> { return this.items; }
  async findByIds(): Promise<MusicianWallet[]> { return []; }
  async existsById(): Promise<{ exists: any[]; not_exists: any[]; }> { return { exists: [], not_exists: [] }; }
  getEntity(): new (...args: any[]) => MusicianWallet {
    return MusicianWallet;
  }
  async findByMusicianId(musicianId: string): Promise<MusicianWallet | null> { return this.items.find(w => w.musician_id.id === musicianId) ?? null; }
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

    const wallet = MusicianWallet.create({ musician_id: "123e4567-e89b-12d3-a456-426614174001" });
    wallet.receiveFunds(200);
    await walletRepo.insert(wallet);

    const output = await useCase.execute({ musician_id: "123e4567-e89b-12d3-a456-426614174001", amount: 50, pix_key: { key: "12345678909", type: "cpf" } });
    expect(output.wallet_balance).toBe(150);
    expect(output.transaction_id).toBeDefined();
  });
});
