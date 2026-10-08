import { Booking } from "../../../../../scheduling/domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../../scheduling/infra/db/in-memory/booking-in-memory.repository";
import { IUnitOfWork } from "../../../../../shared/domain/repository/unit-of-work.interface";
import { BookingEscrow } from "../../../../domain/booking-escrow.aggregate";
import { BookingEscrowStatus } from "../../../../domain/booking-escrow-enums";
import { MusicianWallet } from "../../../../domain/musician-wallet.aggregate";
import { BookingEscrowInMemoryRepository } from "../../../../infra/db/in-memory/booking-escrow-in-memory.repository";
import { MusicianWalletInMemoryRepository } from "../../../../infra/db/in-memory/musician-wallet-in-memory.repository";
import { IBookingEscrowGateway } from "../../../../infra/gateways/booking-escrow-gateway.interface";
import { ReleaseBookingEscrowUseCase } from "../release-booking-escrow.use-case";

const ESTABLISHMENT_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";
const SHOW_START = new Date("2026-09-12T23:00:00Z");
const SHOW_END = new Date("2026-09-13T01:30:00Z");
const NOW = new Date("2026-09-14T23:00:00Z");

// Repositórios in-memory não têm transação; a UoW só executa o bloco.
const uowMock: IUnitOfWork = {
  do: async (fn) => fn(undefined as never),
} as IUnitOfWork;

class RecordingGateway implements IBookingEscrowGateway {
  released: string[] = [];
  refunded: string[] = [];
  failNext = false;

  async createEscrowCharge(): Promise<any> {
    throw new Error("não usado neste teste");
  }

  async findChargeByReference(): Promise<null> {
    return null;
  }

  async releaseEscrow(externalId: string): Promise<void> {
    if (this.failNext) throw new Error("provedor fora do ar");
    this.released.push(externalId);
  }

  async refundEscrow(externalId: string): Promise<void> {
    this.refunded.push(externalId);
  }
}

describe("ReleaseBookingEscrowUseCase", () => {
  let escrowRepo: BookingEscrowInMemoryRepository;
  let walletRepo: MusicianWalletInMemoryRepository;
  let bookingRepo: BookingInMemoryRepository;
  let gateway: RecordingGateway;
  let useCase: ReleaseBookingEscrowUseCase;

  beforeEach(() => {
    escrowRepo = new BookingEscrowInMemoryRepository();
    walletRepo = new MusicianWalletInMemoryRepository();
    bookingRepo = new BookingInMemoryRepository();
    gateway = new RecordingGateway();
    useCase = new ReleaseBookingEscrowUseCase({
      escrowRepo,
      walletRepo,
      gateway,
      bookingRepo,
      uow: uowMock,
      clock: { now: () => NOW },
    });
  });

  async function seed(
    options: {
      checkedIn?: boolean;
      disputed?: boolean;
      musicianId?: string | null;
      withWallet?: boolean;
      externalId?: string;
    } = {},
  ): Promise<{ escrow: BookingEscrow }> {
    const {
      checkedIn = true,
      disputed = false,
      musicianId = MUSICIAN_ID,
      withWallet = true,
      externalId = "pay_123",
    } = options;

    const booking = Booking.create({
      establishment_id: ESTABLISHMENT_ID,
      musician_id: MUSICIAN_ID,
      start_at: SHOW_START,
      end_at: SHOW_END,
      fee: 1500,
    });
    booking.confirm(new Date("2026-09-01T12:00:00Z"));
    if (checkedIn) booking.checkIn({ at: SHOW_END, by: "musician" });
    if (disputed)
      booking.dispute({ reason: "casa alegou atraso", at: SHOW_END });
    await bookingRepo.insert(booking);

    const escrow = BookingEscrow.create({
      booking_id: booking.booking_id.id,
      musician_id: musicianId,
      amount: 1500,
      platform_fee_percentage: 10,
    });
    escrow.markHeld({ external_id: externalId });
    await escrowRepo.insert(escrow);

    if (withWallet) {
      const wallet = MusicianWallet.create({ musician_id: MUSICIAN_ID });
      wallet.holdFunds(1350);
      await walletRepo.insert(wallet);
    }

    return { escrow };
  }

  it("libera no provedor, na custódia e na carteira", async () => {
    const { escrow } = await seed();

    const output = await useCase.execute({
      escrow_id: escrow.escrow_id.id,
      note: "liberação automática",
    });

    expect(gateway.released).toEqual(["pay_123"]);
    expect(output.status).toBe(BookingEscrowStatus.RELEASED);
    expect(output.net_amount).toBe(1350);

    const wallet = await walletRepo.findByMusicianId(MUSICIAN_ID);
    expect(wallet!.held_balance.amount).toBe(0);
    expect(wallet!.balance.amount).toBe(1350);
    // 🔴 `total_earned` só cresce AQUI — é o momento em que a remuneração
    // passou a ser devida.
    expect(wallet!.total_earned.amount).toBe(1350);
  });

  it("chama o PROVEDOR antes de marcar como liberada", async () => {
    // Marcar aqui e falhar lá deixaria o app anunciando um saldo que o gateway
    // recusa a sacar.
    const { escrow } = await seed();
    gateway.failNext = true;

    await expect(
      useCase.execute({ escrow_id: escrow.escrow_id.id }),
    ).rejects.toThrow(/provedor fora do ar/);

    const persisted = await escrowRepo.findById(escrow.escrow_id);
    expect(persisted!.status).toBe(BookingEscrowStatus.HELD);

    const wallet = await walletRepo.findByMusicianId(MUSICIAN_ID);
    expect(wallet!.held_balance.amount).toBe(1350);
    expect(wallet!.balance.amount).toBe(0);
  });

  it("é idempotente — job e webhook não pagam duas vezes o mesmo show", async () => {
    const { escrow } = await seed();

    await useCase.execute({ escrow_id: escrow.escrow_id.id });
    await useCase.execute({ escrow_id: escrow.escrow_id.id });

    expect(gateway.released).toEqual(["pay_123"]);
    const wallet = await walletRepo.findByMusicianId(MUSICIAN_ID);
    expect(wallet!.balance.amount).toBe(1350);
    expect(wallet!.total_earned.amount).toBe(1350);
  });

  it("libera uma custódia CONTESTADA quando a mediação decide pelo artista", async () => {
    const { escrow } = await seed({ disputed: true });
    escrow.dispute({ reason: "casa alegou atraso" });
    await escrowRepo.update(escrow);

    const output = await useCase.execute({
      escrow_id: escrow.escrow_id.id,
      mediation: { justification: "check-in confirmado por vídeo da casa" },
    });

    expect(output.status).toBe(BookingEscrowStatus.RELEASED);

    const persisted = await escrowRepo.findById(escrow.escrow_id);
    expect(persisted!.resolution_note).toContain("Mediação:");
  });

  it("libera no provedor mesmo sem carteira local, sem creditar ninguém", async () => {
    // Nunca cair numa carteira errada por conveniência.
    const { escrow } = await seed({
      musicianId: null,
      withWallet: false,
      externalId: "pay_sem_dono",
    });

    const output = await useCase.execute({ escrow_id: escrow.escrow_id.id });

    expect(output.status).toBe(BookingEscrowStatus.RELEASED);
    expect(gateway.released).toEqual(["pay_sem_dono"]);
  });

  // ── Salvaguardas: a razão de o use-case conhecer o booking ────────────────
  //
  // Estas três não passam pelo job — chamam o use-case DIRETO, que é
  // exatamente o que uma futura rota de "liberar agora" faria. Antes de a
  // regra viver aqui, todas as três liberavam o dinheiro sem reclamar.

  it("NÃO libera sem check-in registrado", async () => {
    const { escrow } = await seed({ checkedIn: false });

    await expect(
      useCase.execute({ escrow_id: escrow.escrow_id.id }),
    ).rejects.toThrow(/Apresentação não registrada/i);

    expect(gateway.released).toEqual([]);
    const wallet = await walletRepo.findByMusicianId(MUSICIAN_ID);
    expect(wallet!.balance.amount).toBe(0);
  });

  it("NÃO libera com contestação em aberto sem mediação", async () => {
    const { escrow } = await seed({ disputed: true });

    await expect(
      useCase.execute({ escrow_id: escrow.escrow_id.id }),
    ).rejects.toThrow(/Contestação em aberto/i);

    expect(gateway.released).toEqual([]);
  });

  it("NÃO libera quando a reserva não existe — 'não sei' é motivo para não pagar", async () => {
    const escrow = BookingEscrow.create({
      booking_id: "99999999-9999-4999-8999-999999999999",
      musician_id: MUSICIAN_ID,
      amount: 1000,
      platform_fee_percentage: 10,
    });
    escrow.markHeld({ external_id: "pay_orfa" });
    await escrowRepo.insert(escrow);

    await expect(
      useCase.execute({ escrow_id: escrow.escrow_id.id }),
    ).rejects.toThrow(/não encontrada/i);

    expect(gateway.released).toEqual([]);
  });

  it("mediação sem justificativa é recusada", async () => {
    const { escrow } = await seed({ checkedIn: false });

    await expect(
      useCase.execute({
        escrow_id: escrow.escrow_id.id,
        mediation: { justification: "   " },
      }),
    ).rejects.toThrow(/justificativa/i);
  });

  it("404 para custódia inexistente", async () => {
    await expect(
      useCase.execute({ escrow_id: "66666666-6666-4666-8666-666666666666" }),
    ).rejects.toThrow(/Not Found/i);
  });
});
