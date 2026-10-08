import { Booking } from "../../../../../scheduling/domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../../scheduling/infra/db/in-memory/booking-in-memory.repository";
import { BookingEscrowStatus } from "../../../../domain/booking-escrow-enums";
import { MusicianWallet } from "../../../../domain/musician-wallet.aggregate";
import { BookingEscrowInMemoryRepository } from "../../../../infra/db/in-memory/booking-escrow-in-memory.repository";
import { MusicianWalletInMemoryRepository } from "../../../../infra/db/in-memory/musician-wallet-in-memory.repository";
import {
  EscrowChargeRequest,
  EscrowChargeResponse,
  IBookingEscrowGateway,
} from "../../../../infra/gateways/booking-escrow-gateway.interface";
import { CreateBookingEscrowUseCase } from "../create-booking-escrow.use-case";

const ESTABLISHMENT_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";
const SHOW_START = new Date("2026-09-12T23:00:00Z");
const SHOW_END = new Date("2026-09-13T01:30:00Z");
const NOW = new Date("2026-09-01T12:00:00Z");

class RecordingGateway implements IBookingEscrowGateway {
  charges: EscrowChargeRequest[] = [];
  failNext = false;
  /** Cobrança que o provedor já tem para uma referência (retomada). */
  existingByReference = new Map<string, EscrowChargeResponse>();
  lookups: string[] = [];

  async createEscrowCharge(
    input: EscrowChargeRequest,
  ): Promise<EscrowChargeResponse> {
    if (this.failNext) throw new Error("provedor fora do ar");
    this.charges.push(input);
    return {
      external_id: "pay_novo",
      status: "PENDING",
      expires_at: new Date("2026-09-20T00:00:00Z"),
    };
  }

  async findChargeByReference(
    reference: string,
  ): Promise<EscrowChargeResponse | null> {
    this.lookups.push(reference);
    return this.existingByReference.get(reference) ?? null;
  }

  async releaseEscrow(): Promise<void> {}
  async refundEscrow(): Promise<void> {}
}

describe("CreateBookingEscrowUseCase", () => {
  let escrowRepo: BookingEscrowInMemoryRepository;
  let bookingRepo: BookingInMemoryRepository;
  let walletRepo: MusicianWalletInMemoryRepository;
  let gateway: RecordingGateway;
  let feePercentage: number;
  let useCase: CreateBookingEscrowUseCase;

  beforeEach(() => {
    escrowRepo = new BookingEscrowInMemoryRepository();
    bookingRepo = new BookingInMemoryRepository();
    walletRepo = new MusicianWalletInMemoryRepository();
    gateway = new RecordingGateway();
    feePercentage = 10;
    useCase = new CreateBookingEscrowUseCase({
      escrowRepo,
      bookingRepo,
      walletRepo,
      gateway,
      planResolver: {
        getMusicianBookingFeePercentage: async () => feePercentage,
      },
      clock: { now: () => NOW },
    });
  });

  async function seedBooking(
    options: {
      confirmed?: boolean;
      fee?: number | null;
      withMusician?: boolean;
    } = {},
  ): Promise<Booking> {
    const { confirmed = true, fee = 1500, withMusician = true } = options;

    const booking = Booking.create({
      establishment_id: ESTABLISHMENT_ID,
      musician_id: withMusician ? MUSICIAN_ID : null,
      band_id: withMusician ? null : "33333333-3333-4333-8333-333333333333",
      start_at: SHOW_START,
      end_at: SHOW_END,
      fee,
    });
    if (confirmed) booking.confirm(NOW);
    await bookingRepo.insert(booking);
    return booking;
  }

  async function seedWallet(
    options: { subaccount?: boolean; escrowEnabled?: boolean } = {},
  ): Promise<MusicianWallet> {
    const { subaccount = true, escrowEnabled = true } = options;

    const wallet = MusicianWallet.create({ musician_id: MUSICIAN_ID });
    if (subaccount) {
      wallet.linkSubaccount({ wallet_id: "wal_musico", api_key: "chave" });
    }
    if (escrowEnabled) wallet.enableEscrow();
    await walletRepo.insert(wallet);
    return wallet;
  }

  it("cria a custódia em pending e registra a cobrança do provedor", async () => {
    const booking = await seedBooking();
    await seedWallet();

    const output = await useCase.execute({ booking_id: booking.booking_id.id });

    expect(output).toMatchObject({
      created: true,
      already_existed: false,
      amount: 1500,
      platform_fee: 150,
      net_amount: 1350,
    });

    const persisted = await escrowRepo.findByBookingId(booking.booking_id.id);
    expect(persisted!.status).toBe(BookingEscrowStatus.PENDING);
    expect(persisted!.external_id).toBe("pay_novo");
  });

  it("usa a taxa do PLANO do músico, não um número fixo", async () => {
    // Toda taxa do sistema mora em plan-features.config.ts; baixar a comissão
    // do PRO é editar aquele arquivo, sem tocar em use-case nenhum.
    feePercentage = 8;
    const booking = await seedBooking();
    await seedWallet();

    const output = await useCase.execute({ booking_id: booking.booking_id.id });

    expect(output).toMatchObject({
      created: true,
      platform_fee: 120,
      net_amount: 1380,
    });
  });

  it("congela a taxa na criação — reajuste posterior não alcança show contratado", async () => {
    const booking = await seedBooking();
    await seedWallet();

    await useCase.execute({ booking_id: booking.booking_id.id });
    feePercentage = 25; // reajuste depois do show já contratado

    const persisted = await escrowRepo.findByBookingId(booking.booking_id.id);
    expect(persisted!.platform_fee.amount).toBe(150);
  });

  it("manda o split para a subconta do MÚSICO, nunca para a plataforma", async () => {
    const booking = await seedBooking();
    await seedWallet();

    await useCase.execute({ booking_id: booking.booking_id.id });

    expect(gateway.charges[0]).toMatchObject({
      beneficiary_wallet_id: "wal_musico",
      amount: 1500,
      platform_fee: 150,
    });
    // A referência tem que ser reconhecível pelo webhook.
    expect(gateway.charges[0].external_reference).toMatch(/^escrow:/);
  });

  it("🔴 NÃO toca no held_balance — a cobrança foi criada, não paga", async () => {
    const booking = await seedBooking();
    await seedWallet();

    await useCase.execute({ booking_id: booking.booking_id.id });

    const wallet = await walletRepo.findByMusicianId(MUSICIAN_ID);
    expect(wallet!.held_balance.amount).toBe(0);
    expect(wallet!.balance.amount).toBe(0);
  });

  it("é idempotente — reentrega do evento não cobra o show duas vezes", async () => {
    const booking = await seedBooking();
    await seedWallet();

    await useCase.execute({ booking_id: booking.booking_id.id });
    const second = await useCase.execute({ booking_id: booking.booking_id.id });

    expect(second).toMatchObject({ created: true, already_existed: true });
    expect(gateway.charges).toHaveLength(1);
  });

  it("vence 48h antes do show", async () => {
    const booking = await seedBooking();
    await seedWallet();

    await useCase.execute({ booking_id: booking.booking_id.id });

    expect(gateway.charges[0].due_date).toEqual(
      new Date(SHOW_START.getTime() - 48 * 3_600_000),
    );
  });

  it("vence hoje quando o show é em menos de 48h — cobrar já é o certo", async () => {
    const emCima = new Date(NOW.getTime() + 3_600_000);
    const booking = Booking.create({
      establishment_id: ESTABLISHMENT_ID,
      musician_id: MUSICIAN_ID,
      start_at: emCima,
      end_at: new Date(emCima.getTime() + 7_200_000),
      fee: 500,
    });
    booking.confirm(NOW);
    await bookingRepo.insert(booking);
    await seedWallet();

    await useCase.execute({ booking_id: booking.booking_id.id });

    expect(gateway.charges[0].due_date).toEqual(NOW);
  });

  // ── Recusas: estado, não exceção ──────────────────────────────────────────
  //
  // Nenhuma delas lança: são o estado do cadastro ou do acordo, e o handler
  // precisa da chave para logar algo acionável.

  it.each([
    [
      "booking inexistente",
      async () => "44444444-4444-4444-8444-444444444444",
      "booking_not_found",
    ],
  ])("recusa com %s", async (_label, getId, reason) => {
    const output = await useCase.execute({ booking_id: await getId() });
    expect(output).toEqual({ created: false, reason });
  });

  it("recusa show não confirmado", async () => {
    const booking = await seedBooking({ confirmed: false });
    await seedWallet();

    const output = await useCase.execute({ booking_id: booking.booking_id.id });

    expect(output).toEqual({ created: false, reason: "booking_not_confirmed" });
    expect(gateway.charges).toHaveLength(0);
  });

  it("recusa show sem cachê — permuta não tem o que custodiar", async () => {
    const booking = await seedBooking({ fee: null });
    await seedWallet();

    const output = await useCase.execute({ booking_id: booking.booking_id.id });

    expect(output).toEqual({ created: false, reason: "no_fee" });
  });

  it("recusa show de banda — o beneficiário não está resolvido", async () => {
    const booking = await seedBooking({ withMusician: false });
    await seedWallet();

    const output = await useCase.execute({ booking_id: booking.booking_id.id });

    expect(output).toEqual({ created: false, reason: "no_musician" });
  });

  it("recusa músico sem subconta no provedor", async () => {
    const booking = await seedBooking();
    await seedWallet({ subaccount: false, escrowEnabled: false });

    const output = await useCase.execute({ booking_id: booking.booking_id.id });

    expect(output).toEqual({ created: false, reason: "no_subaccount" });
  });

  it("🔴 recusa quando a Conta Escrow não está habilitada", async () => {
    // Sem ela o provedor criaria uma cobrança COMUM: o dinheiro cairia liberado
    // na subconta, sem garantia nenhuma, enquanto o contrato afirma custódia.
    const booking = await seedBooking();
    await seedWallet({ escrowEnabled: false });

    const output = await useCase.execute({ booking_id: booking.booking_id.id });

    expect(output).toEqual({ created: false, reason: "escrow_disabled" });
    expect(gateway.charges).toHaveLength(0);
  });

  it("falha do provedor deixa a custódia pending SEM cobrança — reexecutável", async () => {
    const booking = await seedBooking();
    await seedWallet();
    gateway.failNext = true;

    await expect(
      useCase.execute({ booking_id: booking.booking_id.id }),
    ).rejects.toThrow(/provedor fora do ar/);

    const persisted = await escrowRepo.findByBookingId(booking.booking_id.id);
    expect(persisted!.status).toBe(BookingEscrowStatus.PENDING);
    expect(persisted!.external_id).toBeNull();
  });

  it("🔴 RETOMA a custódia órfã em vez de declarar 'já existe'", async () => {
    // Sem isto, a custódia criada numa execução que morreu antes do provedor
    // ficaria pending para sempre: a casa nunca receberia o pedido de
    // pagamento, e o show aconteceria sem cachê custodiado — em silêncio.
    const booking = await seedBooking();
    await seedWallet();
    gateway.failNext = true;
    await expect(
      useCase.execute({ booking_id: booking.booking_id.id }),
    ).rejects.toThrow();

    gateway.failNext = false;
    const retry = await useCase.execute({ booking_id: booking.booking_id.id });

    expect(retry).toMatchObject({ created: true, already_existed: false });
    expect(gateway.charges).toHaveLength(1);

    const persisted = await escrowRepo.findByBookingId(booking.booking_id.id);
    expect(persisted!.external_id).toBe("pay_novo");
  });

  it("a retomada NÃO recalcula a taxa já congelada", async () => {
    const booking = await seedBooking();
    await seedWallet();
    gateway.failNext = true;
    await expect(
      useCase.execute({ booking_id: booking.booking_id.id }),
    ).rejects.toThrow();

    // Reajuste entre a tentativa que falhou e a retomada.
    gateway.failNext = false;
    feePercentage = 25;
    await useCase.execute({ booking_id: booking.booking_id.id });

    const persisted = await escrowRepo.findByBookingId(booking.booking_id.id);
    expect(persisted!.platform_fee.amount).toBe(150);
  });
});
