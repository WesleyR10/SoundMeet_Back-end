import "reflect-metadata";

import { Band } from "@core/musician/domain/band.aggregate";
import { IBandRepository } from "@core/musician/domain/band.repository";
import { Uuid } from "@core/shared/domain/value-objects/uuid.vo";
import {
  MusicianWallet,
  PaymentMethod,
  Tip,
  TipInMemoryRepository,
  TransactionInMemoryRepository,
} from "@core/payment";
import { IMusicianWalletRepository } from "@core/payment/domain/repositories/musician-wallet.repository";
import { DomainEventMediator } from "@core/shared/domain/events/domain-event-mediator";
import { IUnitOfWork } from "@core/shared/domain/repository/unit-of-work.interface";

import { ConfirmTipPaymentUseCase } from "../confirm-tip-payment.use-case";

const uowMock: IUnitOfWork = { do: async (fn) => fn(undefined as any) } as IUnitOfWork;
const domainEventMediatorMock = {
  publish: jest.fn(),
  publishIntegrationEvents: jest.fn(),
} as unknown as DomainEventMediator;

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
      uowMock,
      domainEventMediatorMock,
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

  it("splits the tip only among accepted band members, excluding pending invites", async () => {
    const tipRepo = new TipInMemoryRepository();
    const txRepo = new TransactionInMemoryRepository();
    const walletRepo = new MusicianWalletRepoStub();
    const bandRepo = new BandRepoStub();
    const useCase = new ConfirmTipPaymentUseCase(
      tipRepo,
      txRepo,
      walletRepo,
      bandRepo,
      uowMock,
      domainEventMediatorMock,
    );

    const acceptedMemberA = new Uuid();
    const acceptedMemberB = new Uuid();
    const pendingMember = new Uuid();

    const band = Band.create({ name: "The Band", genres: ["rock"] });
    band.inviteMember(acceptedMemberA, "leader", "vocals");
    band.inviteMember(acceptedMemberB, "member", "guitar");
    band.inviteMember(pendingMember, "member", "drums");
    band.acceptInvite(acceptedMemberA);
    band.acceptInvite(acceptedMemberB);
    await bandRepo.insert(band);

    const tip = Tip.create({
      audience_id: "123e4567-e89b-12d3-a456-426614174000",
      band_id: band.band_id.id,
      amount: 100,
      payment_method: PaymentMethod.PIX,
    });
    await tipRepo.insert(tip);

    await useCase.execute({
      tip_id: tip.tip_id.id,
      payment: { amount: 100, fee: 0, payment_method: PaymentMethod.PIX },
    });

    const walletA = await walletRepo.findByMusicianId(acceptedMemberA.id);
    const walletB = await walletRepo.findByMusicianId(acceptedMemberB.id);
    const walletPending = await walletRepo.findByMusicianId(pendingMember.id);

    expect(walletA).not.toBeNull();
    expect(walletB).not.toBeNull();
    expect(walletA!.balance.amount + walletB!.balance.amount).toBe(100);
    expect(walletPending).toBeNull();
  });
});
