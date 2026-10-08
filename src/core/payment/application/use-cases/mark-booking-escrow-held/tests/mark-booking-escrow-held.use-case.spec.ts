import { IUnitOfWork } from "../../../../../shared/domain/repository/unit-of-work.interface";
import { BookingEscrow } from "../../../../domain/booking-escrow.aggregate";
import { BookingEscrowStatus } from "../../../../domain/booking-escrow-enums";
import { MusicianWallet } from "../../../../domain/musician-wallet.aggregate";
import { BookingEscrowInMemoryRepository } from "../../../../infra/db/in-memory/booking-escrow-in-memory.repository";
import { MusicianWalletInMemoryRepository } from "../../../../infra/db/in-memory/musician-wallet-in-memory.repository";
import { MarkBookingEscrowHeldUseCase } from "../mark-booking-escrow-held.use-case";

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-09-10T12:00:00Z");

// Mesmo mock de `confirm-tip-payment.use-case.spec.ts`: os repositórios
// in-memory não têm transação, então aqui a UoW só executa o bloco.
const uowMock: IUnitOfWork = {
  do: async (fn) => fn(undefined as never),
} as IUnitOfWork;

describe("MarkBookingEscrowHeldUseCase", () => {
  let escrowRepo: BookingEscrowInMemoryRepository;
  let walletRepo: MusicianWalletInMemoryRepository;
  let useCase: MarkBookingEscrowHeldUseCase;

  beforeEach(() => {
    escrowRepo = new BookingEscrowInMemoryRepository();
    walletRepo = new MusicianWalletInMemoryRepository();
    useCase = new MarkBookingEscrowHeldUseCase({
      escrowRepo,
      walletRepo,
      uow: uowMock,
      clock: { now: () => NOW },
    });
  });

  async function seed(
    options: { musicianId?: string | null; attached?: boolean } = {},
  ): Promise<BookingEscrow> {
    const { musicianId = MUSICIAN_ID, attached = true } = options;

    const escrow = BookingEscrow.create({
      booking_id: BOOKING_ID,
      musician_id: musicianId,
      amount: 1500,
      platform_fee_percentage: 10,
    });
    if (attached) escrow.attachCharge({ external_id: "pay_123" });
    await escrowRepo.insert(escrow);

    if (musicianId) {
      await walletRepo.insert(
        MusicianWallet.create({ musician_id: musicianId }),
      );
    }

    return escrow;
  }

  it("retém a custódia e espelha o LÍQUIDO no held_balance", async () => {
    const escrow = await seed();

    const output = await useCase.execute({
      escrow_id: escrow.escrow_id.id,
      external_id: "pay_123",
    });

    expect(output).toMatchObject({
      status: BookingEscrowStatus.HELD,
      changed: true,
    });

    const wallet = await walletRepo.findByMusicianId(MUSICIAN_ID);
    // 🔴 1350, não 1500: a comissão nunca entra no espelho do músico.
    expect(wallet!.held_balance.amount).toBe(1350);
    // Retido não é sacável, e ainda não foi ganho.
    expect(wallet!.balance.amount).toBe(0);
    expect(wallet!.total_earned.amount).toBe(0);
  });

  it("🔴 reentrega do webhook NÃO soma duas vezes ao held_balance", async () => {
    // Webhook duplicado é o caso normal, não a exceção.
    const escrow = await seed();

    await useCase.execute({
      escrow_id: escrow.escrow_id.id,
      external_id: "pay_123",
    });
    const second = await useCase.execute({
      escrow_id: escrow.escrow_id.id,
      external_id: "pay_123",
    });

    expect(second.changed).toBe(false);

    const wallet = await walletRepo.findByMusicianId(MUSICIAN_ID);
    expect(wallet!.held_balance.amount).toBe(1350);
  });

  it("recusa referência divergente da cobrança registrada", async () => {
    // Um webhook com outra referência não é o pagamento DESTA custódia;
    // aceitá-lo marcaria como retido o dinheiro de uma cobrança alheia.
    const escrow = await seed();

    await expect(
      useCase.execute({
        escrow_id: escrow.escrow_id.id,
        external_id: "pay_outro",
      }),
    ).rejects.toThrow();

    const wallet = await walletRepo.findByMusicianId(MUSICIAN_ID);
    expect(wallet!.held_balance.amount).toBe(0);
  });

  it("retém sem creditar ninguém quando a custódia não tem músico", async () => {
    const escrow = await seed({ musicianId: null });

    const output = await useCase.execute({
      escrow_id: escrow.escrow_id.id,
      external_id: "pay_123",
    });

    expect(output.status).toBe(BookingEscrowStatus.HELD);
  });

  it("404 para custódia inexistente", async () => {
    await expect(
      useCase.execute({
        escrow_id: "66666666-6666-4666-8666-666666666666",
        external_id: "pay_x",
      }),
    ).rejects.toThrow(/Not Found/i);
  });
});
