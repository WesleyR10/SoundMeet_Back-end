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
import { DomainEventMediator } from "@core/shared/domain/events/domain-event-mediator";
import { IUnitOfWork } from "@core/shared/domain/repository/unit-of-work.interface";
import { Uuid } from "@core/shared/domain/value-objects/uuid.vo";

import { ConfirmTipPaymentUseCase } from "../confirm-tip-payment.use-case";

const uowMock: IUnitOfWork = {
  do: async (fn) => fn(undefined as any),
} as IUnitOfWork;
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

  async findByMusicianIdForUpdate(
    musicianId: string,
  ): Promise<MusicianWallet | null> {
    return this.findByMusicianId(musicianId);
  }
  /** Não exercitado aqui — o vínculo Mercado Pago não participa da gorjeta confirmada. */
  async findMercadoPagoExpiring(): Promise<MusicianWallet[]> {
    return [];
  }
  async findByMercadoPagoUserId(): Promise<MusicianWallet | null> {
    return null;
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
  async findByMember(): Promise<Band[]> {
    return [];
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
      settlement: "platform",
      tip_id: tip.tip_id.id,
      payment: { amount: 100, fee: 3, payment_method: PaymentMethod.PIX },
    });

    expect(output.tip_id).toBe(tip.tip_id.id);
    expect(output.transaction_id).toBeDefined();
    expect(output.wallet_balance).toBe(97);
  });

  it("não credita de novo quando a gorjeta já está COMPLETED", async () => {
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

    const input = {
      tip_id: tip.tip_id.id,
      settlement: "platform" as const,
      payment: {
        amount: 100,
        fee: 3,
        payment_method: PaymentMethod.PIX,
        external_id: "pay_123",
      },
    };

    const first = await useCase.execute(input);
    // Reentrega que escapou do ledger (retomada após crash, chave diferente).
    const replay = await useCase.execute(input);

    expect(replay.transaction_id).toBe(first.transaction_id);
    expect(replay.wallet_balance).toBe(97);
    expect(walletRepo.items[0].balance.amount).toBe(97);
    expect(txRepo.items).toHaveLength(1);
    expect(txRepo.items[0].external_id).toBe("pay_123");
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
      settlement: "platform",
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

  /*
   * 🔴 Regressão: a divisão da gorjeta entre membros era em REAIS, com
   * `Math.floor(net / n)`, tratando centavos como resto descartável.
   *
   *   - R$30,00 entre 4 dava R$9 ao primeiro e R$7 aos outros três. O justo é
   *     R$7,50: o líder levava R$1,50 tirados dos colegas, e como a soma
   *     fechava em R$30, nada denunciava o desvio.
   *   - R$18,20 entre 3 produzia `6.199999999999999` e o `Money` recusava —
   *     a confirmação falhava INTEIRA, com o pagamento já aprovado no gateway.
   *
   * O teste de split que já existia usava R$100 entre 2, que divide redondo, e
   * por isso passava por cima do defeito.
   */
  describe("divisão entre membros da banda — centavos", () => {
    async function splitAmong(amount: number, memberCount: number) {
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

      const members = Array.from({ length: memberCount }, () => new Uuid());
      const band = Band.create({ name: "The Band", genres: ["rock"] });
      members.forEach((member, index) => {
        band.inviteMember(member, index === 0 ? "leader" : "member", "guitar");
        band.acceptInvite(member);
      });
      await bandRepo.insert(band);

      const tip = Tip.create({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        band_id: band.band_id.id,
        amount,
        payment_method: PaymentMethod.PIX,
      });
      await tipRepo.insert(tip);

      await useCase.execute({
        settlement: "platform",
        tip_id: tip.tip_id.id,
        payment: { amount, fee: 0, payment_method: PaymentMethod.PIX },
      });

      const balances = await Promise.all(
        members.map(async (member) => {
          const wallet = await walletRepo.findByMusicianId(member.id);
          return wallet?.balance.amount ?? 0;
        }),
      );
      return balances;
    }

    it("R$30,00 entre 4 dá R$7,50 a cada um — não R$9 ao líder e R$7 aos outros", async () => {
      expect(await splitAmong(30, 4)).toEqual([7.5, 7.5, 7.5, 7.5]);
    });

    it("R$18,20 entre 3 não derruba a confirmação, e reparte o centavo", async () => {
      expect(await splitAmong(18.2, 3)).toEqual([6.07, 6.07, 6.06]);
    });

    it("R$45,50 entre 2 dá R$22,75 a cada um", async () => {
      expect(await splitAmong(45.5, 2)).toEqual([22.75, 22.75]);
    });

    it.each([
      [30, 4],
      [18.2, 3],
      [10, 3],
      [999.99, 7],
    ])(
      "a soma do que os membros recebem é exatamente a gorjeta (%p entre %p)",
      async (amount, memberCount) => {
        const balances = await splitAmong(amount, memberCount as number);
        const totalCents = balances.reduce(
          (total, balance) => total + Math.round(balance * 100),
          0,
        );
        expect(totalCents).toBe(Math.round(amount * 100));
      },
    );

    it("nenhum membro recebe mais de um centavo a mais que outro", async () => {
      const balances = await splitAmong(999.99, 7);
      const cents = balances.map((b) => Math.round(b * 100));
      expect(Math.max(...cents) - Math.min(...cents)).toBeLessThanOrEqual(1);
    });
  });

  /**
   * 🔴 O bug que custaria dinheiro de verdade.
   *
   * Desde que a gorjeta passou a ser criada na conta Mercado Pago do próprio
   * músico, o valor já é dele quando o pagamento aprova. Creditar `balance`
   * criaria saldo sacável de dinheiro que a plataforma nunca recebeu — e o
   * saque sai do `AsaasGatewayAdapter`, ou seja, do caixa dela.
   */
  describe("procedência da liquidação", () => {
    async function confirmar(settlement: "beneficiary" | "platform") {
      const tipRepo = new TipInMemoryRepository();
      const txRepo = new TransactionInMemoryRepository();
      const walletRepo = new MusicianWalletRepoStub();
      const useCase = new ConfirmTipPaymentUseCase(
        tipRepo,
        txRepo,
        walletRepo,
        new BandRepoStub(),
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

      await useCase.execute({
        tip_id: tip.tip_id.id,
        settlement,
        payment: { amount: 100, fee: 3, payment_method: PaymentMethod.PIX },
      });

      return walletRepo.items[0];
    }

    it('"beneficiary" NÃO credita saldo sacável', async () => {
      const wallet = await confirmar("beneficiary");

      expect(wallet.balance.amount).toBe(0);
      // Mas o ganho é REAL e entra no extrato.
      expect(wallet.total_earned.amount).toBe(97);
    });

    it('"platform" credita saldo sacável, como antes', async () => {
      const wallet = await confirmar("platform");

      expect(wallet.balance.amount).toBe(97);
      expect(wallet.total_earned.amount).toBe(97);
    });
  });
});
