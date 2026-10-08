import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { Booking } from "../booking.aggregate";

/**
 * Proposta é OFERTA: data E cachê (decisão de produto de 25/set/2026).
 * "Para iniciar conversa não precisa; para enviar proposta é obrigatório."
 * Conversar sem valor é a inquiry.
 *
 * A regra vive no agregado, e não num use-case, porque são TRÊS as portas que
 * produzem proposta — propor, converter inquiry e revisar — e uma quarta porta
 * futura herdaria a barreira sem precisar saber que ela existe.
 */
describe("Booking — termos obrigatórios da proposta", () => {
  const HOUR = 60 * 60 * 1000;
  const now = new Date();
  const later = (hours: number) => new Date(now.getTime() + hours * HOUR);

  const createCommand = (fee: number | null) => ({
    establishment_id: new Uuid().id,
    musician_id: new Uuid().id,
    start_at: later(72),
    end_at: later(75),
    fee,
  });

  const feeErrors = (booking: Booking) =>
    booking.notification
      .toJSON()
      .filter((entry) => typeof entry === "object" && "fee" in entry);

  describe("create", () => {
    test.each([null, 0, -50])(
      "recusa proposta com cachê %p — e NÃO emite BookingProposedEvent",
      (fee) => {
        const booking = Booking.create(createCommand(fee));

        expect(feeErrors(booking)).toHaveLength(1);
        // Sem o evento, nenhuma conversa é aberta e nenhum push sai para o
        // artista: uma proposta inválida não pode vazar para fora do agregado.
        expect(Array.from(booking.events)).toHaveLength(0);
      },
    );

    test("aceita proposta com data e cachê, emitindo o evento", () => {
      const booking = Booking.create(createCommand(800));

      expect(booking.notification.hasErrors()).toBe(false);
      expect(booking.fee).toBe(800);
      expect(Array.from(booking.events).map((e) => e.constructor.name)).toEqual(
        ["BookingProposedEvent"],
      );
    });
  });

  describe("reviseProposal", () => {
    const terms = (fee: number | null) => ({
      start_at: later(96),
      end_at: later(99),
      fee,
      notes: null,
      proposed_by: "establishment" as const,
      expires_at: later(48),
      now,
    });

    test.each([null, 0])(
      "recusa revisão com cachê %p e não toca nos termos vigentes",
      (fee) => {
        const booking = Booking.fake()
          .aBooking()
          .withFee(700)
          .expired()
          .build();
        booking.clearEvents();
        const startBefore = booking.start_at;

        booking.reviseProposal(terms(fee));

        expect(feeErrors(booking)).toHaveLength(1);
        expect(booking.fee).toBe(700);
        expect(booking.start_at).toBe(startBefore);
        expect(booking.status.value).toBe("expired");
        expect(Array.from(booking.events)).toHaveLength(0);
      },
    );

    test("revisão é o caminho de quem tinha proposta 'a combinar': passa a ter valor", () => {
      const legacy = Booking.fake().aBooking().withFee(null).pending().build();

      legacy.reviseProposal(terms(950));

      expect(legacy.notification.hasErrors()).toBe(false);
      expect(legacy.fee).toBe(950);
    });
  });

  test("booking ANTIGO sem cachê continua carregável — a regra é de criação, não de leitura", () => {
    // Recusar no construtor derrubaria a carga (mapper → LoadEntityError) de
    // toda proposta "a combinar" gravada antes de 25/set/2026.
    const legacy = Booking.fake().aBooking().withFee(null).pending().build();

    expect(legacy.fee).toBeNull();
    expect(legacy.notification.hasErrors()).toBe(false);
  });
});
