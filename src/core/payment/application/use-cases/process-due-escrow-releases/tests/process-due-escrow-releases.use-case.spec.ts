import { Booking } from "../../../../../scheduling/domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../../scheduling/infra/db/in-memory/booking-in-memory.repository";
import { IUnitOfWork } from "../../../../../shared/domain/repository/unit-of-work.interface";
import { BookingEscrow } from "../../../../domain/booking-escrow.aggregate";
import { BookingEscrowStatus } from "../../../../domain/booking-escrow-enums";
import { MusicianWallet } from "../../../../domain/musician-wallet.aggregate";
import { BookingEscrowInMemoryRepository } from "../../../../infra/db/in-memory/booking-escrow-in-memory.repository";
import { MusicianWalletInMemoryRepository } from "../../../../infra/db/in-memory/musician-wallet-in-memory.repository";
import { IBookingEscrowGateway } from "../../../../infra/gateways/booking-escrow-gateway.interface";
import { ReleaseBookingEscrowUseCase } from "../../release-booking-escrow/release-booking-escrow.use-case";
import { ProcessDueEscrowReleasesUseCase } from "../process-due-escrow-releases.use-case";

const ESTABLISHMENT_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";

const SHOW_START = new Date("2026-09-12T23:00:00Z");
const SHOW_END = new Date("2026-09-13T01:30:00Z");
/** D+3 depois do fim: passou do D+2 (pago) e não do D+5 (FREE). */
const NOW = new Date("2026-09-16T01:30:00Z");

// Repositórios in-memory não têm transação; a UoW só executa o bloco.
const uowMock: IUnitOfWork = {
  do: async (fn) => fn(undefined as never),
} as IUnitOfWork;

class FakeGateway implements IBookingEscrowGateway {
  released: string[] = [];
  async createEscrowCharge(): Promise<any> {
    throw new Error("não usado");
  }
  async findChargeByReference(): Promise<null> {
    return null;
  }
  async releaseEscrow(externalId: string): Promise<void> {
    this.released.push(externalId);
  }
  async refundEscrow(): Promise<void> {}
}

describe("ProcessDueEscrowReleasesUseCase", () => {
  let escrowRepo: BookingEscrowInMemoryRepository;
  let bookingRepo: BookingInMemoryRepository;
  let walletRepo: MusicianWalletInMemoryRepository;
  let gateway: FakeGateway;
  let releaseDays: number;

  function buildUseCase() {
    return new ProcessDueEscrowReleasesUseCase({
      escrowRepo,
      bookingRepo,
      releaseUseCase: new ReleaseBookingEscrowUseCase({
        escrowRepo,
        walletRepo,
        gateway,
        bookingRepo,
        uow: uowMock,
        clock: { now: () => NOW },
      }),
      planResolver: {
        getMusicianEscrowReleaseDays: async () => releaseDays,
      },
      clock: { now: () => NOW },
    });
  }

  beforeEach(() => {
    escrowRepo = new BookingEscrowInMemoryRepository();
    bookingRepo = new BookingInMemoryRepository();
    walletRepo = new MusicianWalletInMemoryRepository();
    gateway = new FakeGateway();
    releaseDays = 2;
  });

  async function seed(
    options: { checkedIn?: boolean; disputed?: boolean } = {},
  ): Promise<BookingEscrow> {
    const { checkedIn = true, disputed = false } = options;

    const booking = Booking.create({
      establishment_id: ESTABLISHMENT_ID,
      musician_id: MUSICIAN_ID,
      start_at: SHOW_START,
      end_at: SHOW_END,
      fee: 1500,
    });
    booking.confirm(new Date("2026-09-01T12:00:00Z"));
    if (checkedIn) {
      booking.checkIn({ at: SHOW_END, by: "musician" });
    }
    if (disputed) {
      booking.dispute({ reason: "tocou menos que o combinado", at: SHOW_END });
    }
    await bookingRepo.insert(booking);

    const escrow = BookingEscrow.create({
      booking_id: booking.booking_id.id,
      musician_id: MUSICIAN_ID,
      amount: 1500,
      platform_fee_percentage: 10,
    });
    escrow.markHeld({
      external_id: "pay_123",
      at: new Date("2026-09-10T12:00:00Z"),
    });
    await escrowRepo.insert(escrow);

    const wallet = MusicianWallet.create({ musician_id: MUSICIAN_ID });
    wallet.holdFunds(1350);
    await walletRepo.insert(wallet);

    return escrow;
  }

  it("libera quando houve check-in e o prazo venceu", async () => {
    await seed();

    const output = await buildUseCase().execute();

    expect(output.released).toBe(1);
    expect(gateway.released).toEqual(["pay_123"]);
    const wallet = await walletRepo.findByMusicianId(MUSICIAN_ID);
    expect(wallet!.balance.amount).toBe(1350);
  });

  it("NÃO libera sem check-in", async () => {
    // Liberar só por prazo entregaria o cachê de um show que ninguém confirmou
    // ter acontecido.
    const escrow = await seed({ checkedIn: false });

    const output = await buildUseCase().execute();

    expect(output.released).toBe(0);
    expect(output.skipped).toEqual([
      { escrow_id: escrow.escrow_id.id, reason: "apresentação não registrada" },
    ]);
    expect(gateway.released).toEqual([]);
  });

  it("NÃO libera com contestação em aberto", async () => {
    // Liberar aqui seria decidir a disputa a favor de um lado por omissão.
    const escrow = await seed({ disputed: true });

    const output = await buildUseCase().execute();

    expect(output.released).toBe(0);
    expect(output.skipped[0]).toEqual({
      escrow_id: escrow.escrow_id.id,
      reason: "contestação em aberto",
    });
  });

  it("respeita o holdback do PLANO — FREE ainda espera no D+3", async () => {
    releaseDays = 5;
    await seed();

    const output = await buildUseCase().execute();

    expect(output.released).toBe(0);
    expect(output.skipped[0].reason).toMatch(/prazo de contestação em curso/);
  });

  it("conta o prazo a partir do FIM DO SHOW, não da retenção", async () => {
    // O pagamento é antecipado: contar da retenção liberaria antes de o show
    // acontecer para quem pagou com muita antecedência.
    releaseDays = 2;
    const escrow = await seed();
    // Retida 6 dias antes de "agora", mas o show terminou há 3.
    expect(escrow.held_at!.getTime()).toBeLessThan(SHOW_END.getTime());

    expect((await buildUseCase().execute()).released).toBe(1);
  });

  it("uma custódia problemática não derruba as outras", async () => {
    await seed();

    // Custódia órfã: booking apagado. Não pode travar o pagamento de ninguém.
    const orfa = BookingEscrow.create({
      booking_id: "44444444-4444-4444-8444-444444444444",
      musician_id: MUSICIAN_ID,
      amount: 800,
      platform_fee_percentage: 10,
    });
    orfa.markHeld({
      external_id: "pay_orfa",
      at: new Date("2026-09-10T12:00:00Z"),
    });
    await escrowRepo.insert(orfa);

    const output = await buildUseCase().execute();

    expect(output.examined).toBe(2);
    expect(output.released).toBe(1);
    expect(output.skipped).toEqual([
      { escrow_id: orfa.escrow_id.id, reason: "booking não encontrado" },
    ]);
  });

  it("ignora custódia que não está retida", async () => {
    const escrow = await seed();
    escrow.refund({ reason: "show cancelado" });
    await escrowRepo.update(escrow);

    const output = await buildUseCase().execute();

    expect(output.examined).toBe(0);
    expect(output.released).toBe(0);
    expect(escrow.status).toBe(BookingEscrowStatus.REFUNDED);
  });
});
