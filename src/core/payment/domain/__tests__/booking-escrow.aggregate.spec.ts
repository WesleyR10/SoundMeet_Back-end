import { Money } from "../../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { BookingEscrow } from "../booking-escrow.aggregate";
import { BookingEscrowStatus } from "../booking-escrow-enums";
import { BookingEscrowReleasedEvent } from "../events/booking-escrow-released.event";

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-09-12T23:00:00Z");

function novaCustodia(amount = 1500, feePct = 10) {
  return BookingEscrow.create({
    booking_id: BOOKING_ID,
    musician_id: MUSICIAN_ID,
    amount,
    platform_fee_percentage: feePct,
  });
}

describe("BookingEscrow", () => {
  describe("criação", () => {
    it("nasce pendente e congela a comissão no ato", () => {
      const escrow = novaCustodia(1500, 10);

      expect(escrow.status).toBe(BookingEscrowStatus.PENDING);
      expect(escrow.amount.amount).toBe(1500);
      expect(escrow.platform_fee.amount).toBe(150);
      expect(escrow.net_amount.amount).toBe(1350);
      expect(escrow.notification.hasErrors()).toBe(false);
    });

    it("arredonda a comissão a centavos, sem estourar o Money", () => {
      // `Money` recusa mais de duas casas — 9% de R$333,33 dá 29,9997.
      const escrow = novaCustodia(333.33, 9);

      expect(escrow.platform_fee.amount).toBe(30);
      expect(escrow.net_amount.amount).toBe(303.33);
    });

    it("recusa custódia sem valor", () => {
      const escrow = BookingEscrow.create({
        booking_id: BOOKING_ID,
        amount: 0,
        platform_fee_percentage: 10,
      });

      expect(escrow.notification.hasErrors()).toBe(true);
    });
  });

  describe("registro da cobrança", () => {
    it("guarda a referência sem reter — cobrança criada não é cobrança paga", () => {
      const escrow = novaCustodia();

      escrow.attachCharge({ external_id: "pay_123", at: NOW });

      expect(escrow.external_id).toBe("pay_123");
      // 🔴 Continua PENDING: reter aqui anunciaria como retido um valor que o
      // estabelecimento ainda pode simplesmente não pagar.
      expect(escrow.status).toBe(BookingEscrowStatus.PENDING);
      expect(escrow.held_at).toBeNull();
    });

    it("é no-op ao reexecutar com a MESMA referência", () => {
      const escrow = novaCustodia();
      escrow.attachCharge({ external_id: "pay_123", at: NOW });

      escrow.attachCharge({ external_id: "pay_123", at: NOW });

      expect(escrow.notification.hasErrors()).toBe(false);
      expect(escrow.external_id).toBe("pay_123");
    });

    it("recusa uma SEGUNDA cobrança para o mesmo show", () => {
      const escrow = novaCustodia();
      escrow.attachCharge({ external_id: "pay_123", at: NOW });

      escrow.attachCharge({ external_id: "pay_outro", at: NOW });

      expect(escrow.notification.hasErrors()).toBe(true);
      expect(escrow.external_id).toBe("pay_123");
    });

    it("recusa registrar cobrança em custódia já retida", () => {
      const escrow = novaCustodia();
      escrow.markHeld({ external_id: "pay_123", at: NOW });

      escrow.attachCharge({ external_id: "pay_123", at: NOW });

      expect(escrow.notification.hasErrors()).toBe(true);
    });
  });

  describe("retenção", () => {
    it("retém a cobrança já registrada, preservando a referência", () => {
      const escrow = novaCustodia();
      escrow.attachCharge({ external_id: "pay_123", at: NOW });

      escrow.markHeld({ external_id: "pay_123", at: NOW });

      expect(escrow.notification.hasErrors()).toBe(false);
      expect(escrow.status).toBe(BookingEscrowStatus.HELD);
    });

    it("🔴 recusa reter com referência DIFERENTE da cobrança registrada", () => {
      // Um webhook com outra referência não é o pagamento desta custódia;
      // sobrescrever deixaria a cobrança original órfã.
      const escrow = novaCustodia();
      escrow.attachCharge({ external_id: "pay_123", at: NOW });

      escrow.markHeld({ external_id: "pay_alheio", at: NOW });

      expect(escrow.notification.hasErrors()).toBe(true);
      expect(escrow.status).toBe(BookingEscrowStatus.PENDING);
    });

    it("retém com a referência do provedor e o prazo", () => {
      const escrow = novaCustodia();
      const expira = new Date("2026-09-14T23:00:00Z");

      escrow.markHeld({ external_id: "pay_123", expires_at: expira, at: NOW });

      expect(escrow.status).toBe(BookingEscrowStatus.HELD);
      expect(escrow.external_id).toBe("pay_123");
      expect(escrow.expires_at).toEqual(expira);
      expect(escrow.held_at).toEqual(NOW);
      expect(escrow.notification.hasErrors()).toBe(false);
    });

    it("recusa reter sem referência do provedor", () => {
      // Sem `external_id` não há como liberar nem estornar depois — a custódia
      // viraria dinheiro sem dono operável.
      const escrow = novaCustodia();
      escrow.markHeld({ external_id: "  " });

      expect(escrow.status).toBe(BookingEscrowStatus.PENDING);
      expect(escrow.notification.hasErrors()).toBe(true);
    });

    it("é IDEMPOTENTE para a reentrega do mesmo webhook", () => {
      // Webhook duplicado é o caso normal, não a exceção.
      const escrow = novaCustodia();
      escrow.markHeld({ external_id: "pay_123", at: NOW });
      escrow.markHeld({ external_id: "pay_123", at: new Date() });

      expect(escrow.status).toBe(BookingEscrowStatus.HELD);
      expect(escrow.held_at).toEqual(NOW);
      expect(escrow.notification.hasErrors()).toBe(false);
    });

    it("recusa uma SEGUNDA referência diferente", () => {
      // Isso não é reentrega: são dois pagamentos apontando para a mesma
      // custódia, e aceitar em silêncio perderia um deles.
      const escrow = novaCustodia();
      escrow.markHeld({ external_id: "pay_123" });
      escrow.markHeld({ external_id: "pay_OUTRO" });

      expect(escrow.external_id).toBe("pay_123");
      expect(escrow.notification.hasErrors()).toBe(true);
    });
  });

  describe("liberação", () => {
    it("libera a partir de retida e emite o evento com o líquido e a comissão", () => {
      const escrow = novaCustodia();
      escrow.markHeld({ external_id: "pay_123" });

      escrow.release({ at: NOW });

      expect(escrow.status).toBe(BookingEscrowStatus.RELEASED);
      expect(escrow.released_at).toEqual(NOW);

      const event = [...escrow.events].find(
        (e) => e instanceof BookingEscrowReleasedEvent,
      ) as BookingEscrowReleasedEvent;
      expect(event).toBeDefined();
      expect(event.net_amount).toBe(1350);
      expect(event.platform_fee).toBe(150);
    });

    it("libera a partir de contestada — a mediação decidiu pelo artista", () => {
      const escrow = novaCustodia();
      escrow.markHeld({ external_id: "pay_123" });
      escrow.dispute({ reason: "artista não apareceu" });

      escrow.release({ at: NOW, note: "mediação: check-in confirmado" });

      expect(escrow.status).toBe(BookingEscrowStatus.RELEASED);
      expect(escrow.resolution_note).toBe("mediação: check-in confirmado");
    });

    it("liberar duas vezes é no-op, não erro", () => {
      // Job e webhook do provedor podem chegar os dois; transformar isso em
      // erro encheria o log de falha onde não houve nenhuma.
      const escrow = novaCustodia();
      escrow.markHeld({ external_id: "pay_123" });
      escrow.release({ at: NOW });
      escrow.release({ at: new Date() });

      expect(escrow.released_at).toEqual(NOW);
      expect(escrow.notification.hasErrors()).toBe(false);
    });

    it("recusa liberar o que nunca foi retido", () => {
      const escrow = novaCustodia();
      escrow.release();

      expect(escrow.status).toBe(BookingEscrowStatus.PENDING);
      expect(escrow.notification.hasErrors()).toBe(true);
    });
  });

  describe("estorno", () => {
    it("devolve com motivo registrado", () => {
      const escrow = novaCustodia();
      escrow.markHeld({ external_id: "pay_123" });

      escrow.refund({ reason: "show cancelado pelo estabelecimento", at: NOW });

      expect(escrow.status).toBe(BookingEscrowStatus.REFUNDED);
      expect(escrow.refunded_at).toEqual(NOW);
      expect(escrow.resolution_note).toBe(
        "show cancelado pelo estabelecimento",
      );
    });

    it("recusa estorno sem motivo", () => {
      // Lançamento sem justificativa é o que ninguém explica seis meses depois.
      const escrow = novaCustodia();
      escrow.markHeld({ external_id: "pay_123" });
      escrow.refund({ reason: "   " });

      expect(escrow.status).toBe(BookingEscrowStatus.HELD);
      expect(escrow.notification.hasErrors()).toBe(true);
    });

    it("recusa estornar o que já foi liberado", () => {
      const escrow = novaCustodia();
      escrow.markHeld({ external_id: "pay_123" });
      escrow.release();
      escrow.refund({ reason: "arrependimento" });

      expect(escrow.status).toBe(BookingEscrowStatus.RELEASED);
      expect(escrow.notification.hasErrors()).toBe(true);
    });
  });

  describe("contestação", () => {
    it("congela a custódia retida", () => {
      const escrow = novaCustodia();
      escrow.markHeld({ external_id: "pay_123" });

      escrow.dispute({ reason: "banda tocou 40 minutos, não 2 horas" });

      expect(escrow.status).toBe(BookingEscrowStatus.DISPUTED);
      expect(escrow.resolution_note).toBe(
        "banda tocou 40 minutos, não 2 horas",
      );
    });

    it("recusa contestar o que ainda não entrou ou o que já saiu", () => {
      const naoEntrou = novaCustodia();
      naoEntrou.dispute({ reason: "qualquer" });
      expect(naoEntrou.status).toBe(BookingEscrowStatus.PENDING);
      expect(naoEntrou.notification.hasErrors()).toBe(true);

      const jaSaiu = novaCustodia();
      jaSaiu.markHeld({ external_id: "pay_123" });
      jaSaiu.release();
      jaSaiu.dispute({ reason: "tarde demais" });
      expect(jaSaiu.status).toBe(BookingEscrowStatus.RELEASED);
      expect(jaSaiu.notification.hasErrors()).toBe(true);
    });
  });

  describe("fake builder", () => {
    it("monta custódia retida pronta para teste", () => {
      const escrow = BookingEscrow.fake().anEscrow().held().build();

      expect(escrow.status).toBe(BookingEscrowStatus.HELD);
      expect(escrow.external_id).not.toBeNull();
      expect(escrow.isHeld).toBe(true);
    });

    it("gera Money com no máximo duas casas", () => {
      // Armadilha que já derrubou tip-fake e transaction-fake: o default do
      // chance é 4 casas, e o VO recusa.
      const escrows = BookingEscrow.fake().theEscrows(20).build();
      for (const escrow of escrows) {
        expect(escrow.notification.hasErrors()).toBe(false);
      }
    });
  });

  it("toJSON expõe o snapshot inteiro", () => {
    const escrow = new BookingEscrow({
      booking_id: new Uuid(BOOKING_ID),
      musician_id: new Uuid(MUSICIAN_ID),
      amount: new Money(1000),
      platform_fee: new Money(100),
      net_amount: new Money(900),
    });

    expect(escrow.toJSON()).toMatchObject({
      booking_id: BOOKING_ID,
      musician_id: MUSICIAN_ID,
      amount: 1000,
      platform_fee: 100,
      net_amount: 900,
      status: BookingEscrowStatus.PENDING,
    });
  });
});
