import { Booking } from "../booking.aggregate";

/**
 * Check-in e contestação (F1.3a).
 *
 * O check-in é a prova de execução do serviço — vale contra chargeback com ou
 * sem escrow, e é a primeira das duas condições que liberam a custódia.
 */
const ESTABLISHMENT_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";

const START = new Date("2026-09-12T23:00:00Z");
const END = new Date("2026-09-13T01:30:00Z");
const DURANTE = new Date("2026-09-12T23:30:00Z");

function bookingConfirmado(): Booking {
  const booking = Booking.create({
    establishment_id: ESTABLISHMENT_ID,
    musician_id: MUSICIAN_ID,
    start_at: START,
    end_at: END,
    fee: 1500,
  });
  booking.confirm(new Date("2026-09-01T12:00:00Z"));
  return booking;
}

describe("Booking — check-in", () => {
  it("registra a apresentação durante o show", () => {
    const booking = bookingConfirmado();

    booking.checkIn({ at: DURANTE, by: "musician" });

    expect(booking.checked_in_at).toEqual(DURANTE);
    expect(booking.checked_in_by).toBe("musician");
    expect(booking.isCheckedIn).toBe(true);
    expect(booking.notification.hasErrors()).toBe(false);
  });

  it("recusa check-in ANTES do show começar", () => {
    // Declarar um fato futuro é o tipo de "prova" que não prova nada.
    const booking = bookingConfirmado();

    booking.checkIn({ at: new Date("2026-09-12T20:00:00Z"), by: "musician" });

    expect(booking.checked_in_at).toBeNull();
    expect(booking.notification.hasErrors()).toBe(true);
  });

  it("aceita check-in DEPOIS do fim — o músico pode registrar ao descer do palco", () => {
    const booking = bookingConfirmado();

    booking.checkIn({ at: new Date("2026-09-13T02:00:00Z"), by: "musician" });

    expect(booking.isCheckedIn).toBe(true);
    expect(booking.notification.hasErrors()).toBe(false);
  });

  it("recusa check-in em booking não confirmado", () => {
    // Prova de execução de um serviço que ninguém contratou é o oposto do que
    // este registro existe para fazer.
    const booking = Booking.create({
      establishment_id: ESTABLISHMENT_ID,
      musician_id: MUSICIAN_ID,
      start_at: START,
      end_at: END,
      fee: 1500,
    });

    booking.checkIn({ at: DURANTE, by: "musician" });

    expect(booking.checked_in_at).toBeNull();
    expect(booking.notification.hasErrors()).toBe(true);
  });

  it("é idempotente — repetir não move a data do fato", () => {
    const booking = bookingConfirmado();
    booking.checkIn({ at: DURANTE, by: "musician" });

    booking.checkIn({ at: new Date("2026-09-13T05:00:00Z"), by: "band" });

    expect(booking.checked_in_at).toEqual(DURANTE);
    expect(booking.checked_in_by).toBe("musician");
    expect(booking.notification.hasErrors()).toBe(false);
  });
});

describe("Booking — contestação", () => {
  it("registra a contestação com motivo", () => {
    const booking = bookingConfirmado();

    booking.dispute({ reason: "banda tocou 40 minutos", at: DURANTE });

    expect(booking.isDisputed).toBe(true);
    expect(booking.dispute_reason).toBe("banda tocou 40 minutos");
  });

  it("NÃO exige check-in prévio", () => {
    // "O artista não apareceu" é justamente a contestação em que o check-in
    // não existe.
    const booking = bookingConfirmado();

    booking.dispute({ reason: "artista não compareceu", at: DURANTE });

    expect(booking.isCheckedIn).toBe(false);
    expect(booking.isDisputed).toBe(true);
    expect(booking.notification.hasErrors()).toBe(false);
  });

  it("recusa contestação sem motivo", () => {
    const booking = bookingConfirmado();

    booking.dispute({ reason: "   ", at: DURANTE });

    expect(booking.isDisputed).toBe(false);
    expect(booking.notification.hasErrors()).toBe(true);
  });

  it("é idempotente — a primeira contestação é a que vale", () => {
    const booking = bookingConfirmado();
    booking.dispute({ reason: "primeiro motivo", at: DURANTE });

    booking.dispute({ reason: "motivo reescrito depois", at: new Date() });

    expect(booking.dispute_reason).toBe("primeiro motivo");
    expect(booking.disputed_at).toEqual(DURANTE);
  });
});
