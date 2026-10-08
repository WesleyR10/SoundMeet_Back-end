import { BookingEscrow } from "../../../../domain/booking-escrow.aggregate";
import { BookingEscrowStatus } from "../../../../domain/booking-escrow-enums";
import { BookingEscrowInMemoryRepository } from "../../../../infra/db/in-memory/booking-escrow-in-memory.repository";
import { GetMusicianEscrowsUseCase } from "../get-musician-escrows.use-case";

const DONO = "22222222-2222-4222-8222-222222222222";
const OUTRO = "33333333-3333-4333-8333-333333333333";

describe("GetMusicianEscrowsUseCase", () => {
  let repo: BookingEscrowInMemoryRepository;
  let useCase: GetMusicianEscrowsUseCase;

  beforeEach(async () => {
    repo = new BookingEscrowInMemoryRepository();
    useCase = new GetMusicianEscrowsUseCase(repo);

    await seed(DONO, "11111111-1111-4111-8111-111111111111", 1500);
    await seed(DONO, "44444444-4444-4444-8444-444444444444", 800);
    await seed(OUTRO, "55555555-5555-4555-8555-555555555555", 9000);
  });

  async function seed(musicianId: string, bookingId: string, amount: number) {
    const escrow = BookingEscrow.create({
      booking_id: bookingId,
      musician_id: musicianId,
      amount,
      platform_fee_percentage: 10,
    });
    escrow.markHeld({ external_id: `pay_${bookingId.slice(0, 4)}` });
    await repo.insert(escrow);
    return escrow;
  }

  it("devolve só as custódias do músico da rota", async () => {
    const output = await useCase.execute({ musician_id: DONO });

    expect(output.total).toBe(2);
    expect(output.items.map((i) => i.amount).sort((a, b) => a - b)).toEqual([
      800, 1500,
    ]);
  });

  it("🔴 filtro da query NÃO amplia o escopo para outro músico", async () => {
    // O ownership guard autoriza o dono da URL, mas não escopa a consulta: se
    // `musician_id` viesse ANTES do spread do filtro, um
    // `?filter[musician_id]=<alheio>` devolveria a custódia de outra pessoa —
    // valor de cachê, comissão e estágio de pagamento.
    const output = await useCase.execute({
      musician_id: DONO,
      filter: { musician_id: OUTRO } as never,
    });

    expect(output.total).toBe(2);
    expect(output.items.every((i) => i.musician_id === DONO)).toBe(true);
    expect(output.items.some((i) => i.amount === 9000)).toBe(false);
  });

  it("aceita refino por status dentro do escopo", async () => {
    const [primeira] = (await repo.findAll()).filter(
      (e) => e.musician_id?.id === DONO,
    );
    primeira.refund({ reason: "show cancelado" });
    await repo.update(primeira);

    const output = await useCase.execute({
      musician_id: DONO,
      filter: { status: BookingEscrowStatus.HELD },
    });

    expect(output.total).toBe(1);
    expect(output.items[0].status).toBe(BookingEscrowStatus.HELD);
  });

  it("🔴 NUNCA expõe external_id — é a chave que move dinheiro no provedor", async () => {
    const output = await useCase.execute({ musician_id: DONO });

    for (const item of output.items) {
      expect(item).not.toHaveProperty("external_id");
    }
    // A redação depende de um destructuring; um refactor de `{...otherProps}`
    // a desfaria em silêncio, e este teste é o que impede isso.
    expect(JSON.stringify(output)).not.toContain("pay_");
  });

  it("expõe a decomposição do valor — é o que o músico confere", async () => {
    const output = await useCase.execute({ musician_id: DONO });
    const item = output.items.find((i) => i.amount === 1500)!;

    expect(item.platform_fee).toBe(150);
    expect(item.net_amount).toBe(1350);
    expect(item.platform_fee + item.net_amount).toBe(item.amount);
  });
});
