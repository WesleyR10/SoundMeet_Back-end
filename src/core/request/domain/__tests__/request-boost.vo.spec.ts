import { InvalidArgumentError } from "../../../shared/domain/errors/invalid-argument.error";
import { Money } from "../../../shared/domain/value-objects/money.vo";
import {
  REQUEST_BOOST_DEDICATION_MAX_LENGTH,
  RequestBoost,
  RequestBoostStatusEnum,
} from "../value-objects/request-boost.vo";

const TIP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function promised(
  overrides: Partial<ConstructorParameters<typeof RequestBoost>[0]> = {},
) {
  return new RequestBoost({ amount: new Money(10), ...overrides });
}

describe("RequestBoost Unit Tests", () => {
  describe("construção", () => {
    test("nasce em promised, sem cobrança", () => {
      const boost = promised();

      expect(boost.status).toBe(RequestBoostStatusEnum.PROMISED);
      expect(boost.tip_id).toBeNull();
      expect(boost.paid_at).toBeNull();
      expect(boost.isPromised).toBe(true);
    });

    test("recusa valor zero ou negativo", () => {
      expect(() => promised({ amount: new Money(0) })).toThrow(
        InvalidArgumentError,
      );
    });

    test("recusa dedicatória acima do limite", () => {
      const tooLong = "a".repeat(REQUEST_BOOST_DEDICATION_MAX_LENGTH + 1);
      expect(() => promised({ dedication: tooLong })).toThrow(
        InvalidArgumentError,
      );
    });

    test("normaliza dedicatória em branco para null", () => {
      expect(promised({ dedication: "   " }).dedication).toBeNull();
    });

    /*
     * É o estado mais perigoso do fluxo: um destaque que se diz pago sem nada
     * do lado do provedor. Barrar na construção impede que ele exista sequer
     * em memória — inclusive vindo de uma linha meio preenchida do banco.
     */
    test("recusa awaiting_payment ou paid sem tip_id", () => {
      expect(() =>
        promised({ status: RequestBoostStatusEnum.AWAITING_PAYMENT }),
      ).toThrow(/requires a tip_id/);

      expect(() =>
        promised({ status: RequestBoostStatusEnum.PAID, paid_at: new Date() }),
      ).toThrow(/requires a tip_id/);
    });

    test("recusa awaiting_payment ou paid sem charged_at", () => {
      expect(() =>
        promised({
          status: RequestBoostStatusEnum.AWAITING_PAYMENT,
          tip_id: TIP_ID,
        }),
      ).toThrow(/requires charged_at/);
    });

    test("recusa paid sem paid_at", () => {
      expect(() =>
        promised({
          status: RequestBoostStatusEnum.PAID,
          tip_id: TIP_ID,
          charged_at: new Date(),
        }),
      ).toThrow(/requires paid_at/);
    });
  });

  describe("transições", () => {
    test("promised -> awaiting_payment guarda a cobrança", () => {
      const boost = promised().withCharge(TIP_ID);

      expect(boost.status).toBe(RequestBoostStatusEnum.AWAITING_PAYMENT);
      expect(boost.tip_id).toBe(TIP_ID);
    });

    test("awaiting_payment -> paid registra a data", () => {
      const paidAt = new Date("2026-08-27T21:00:00.000Z");
      const boost = promised().withCharge(TIP_ID).markPaid(paidAt);

      expect(boost.status).toBe(RequestBoostStatusEnum.PAID);
      expect(boost.paid_at).toEqual(paidAt);
    });

    test("promised -> cancelled guarda o motivo", () => {
      const boost = promised().cancel("request_rejected");

      expect(boost.status).toBe(RequestBoostStatusEnum.CANCELLED);
      expect(boost.cancellation_reason).toBe("request_rejected");
    });

    test("awaiting_payment -> expired", () => {
      const boost = promised().withCharge(TIP_ID).markExpired();
      expect(boost.status).toBe(RequestBoostStatusEnum.EXPIRED);
    });

    test("é imutável — a transição devolve outra instância", () => {
      const original = promised();
      const charged = original.withCharge(TIP_ID);

      expect(original.status).toBe(RequestBoostStatusEnum.PROMISED);
      expect(original.tip_id).toBeNull();
      expect(charged).not.toBe(original);
    });

    /*
     * O caminho que cobraria duas vezes: pular o aceite e marcar pago direto,
     * ou ressuscitar um destaque terminal.
     */
    test("recusa pular awaiting_payment", () => {
      expect(() => promised().markPaid()).toThrow(/Cannot transition boost/);
    });

    test("pago não volta a esperar nem a cancelar — só vai a reembolso", () => {
      const paid = promised().withCharge(TIP_ID).markPaid();
      expect(() => paid.markExpired()).toThrow(/Cannot transition boost/);
      expect(() => paid.cancel("x")).toThrow(/Cannot transition boost/);
      expect(paid.markRefundPending("request_rejected").status).toBe(
        RequestBoostStatusEnum.REFUND_PENDING,
      );
    });

    // PIX pago FORA da janela: o fã pagou, e o pedido ainda está na mesa.
    test("vencido ainda aceita o pagamento tardio", () => {
      const expired = promised().withCharge(TIP_ID).markExpired();
      expect(expired.markPaid().status).toBe(RequestBoostStatusEnum.PAID);
    });

    // O QR segue pagável depois da recusa: o dinheiro que chegar volta.
    test("cancelado com PIX só sai para reembolso, com o instante do pagamento", () => {
      const cancelled = promised().withCharge(TIP_ID).cancel("request_rejected");
      expect(() => cancelled.markPaid()).toThrow(/Cannot transition boost/);
      const paidAt = new Date("2026-09-28T23:00:00Z");
      const refund = cancelled.markRefundPending("paid_after_rejection", paidAt);
      expect(refund.status).toBe(RequestBoostStatusEnum.REFUND_PENDING);
      expect(refund.paid_at).toEqual(paidAt);
    });

    test("promessa antiga cancelada não é mais cobrável", () => {
      const cancelled = promised().cancel("x");
      expect(() => cancelled.withCharge(TIP_ID)).toThrow(/Cannot transition boost/);
    });

    test("reembolso pendente é terminal (até o reembolso existir)", () => {
      const refund = promised().withCharge(TIP_ID).markPaid().markRefundPending("x");
      expect(() => refund.markPaid()).toThrow(/Cannot transition boost/);
      expect(() => refund.cancel("x")).toThrow(/Cannot transition boost/);
    });

    test("recusa cobrança sem tip_id", () => {
      expect(() => promised().withCharge("  ")).toThrow(/tip_id is required/);
    });
  });

  describe("isBoosting", () => {
    /*
     * 🔴 SÓ `paid` destaca (paga antes, destaca depois — 28/set/2026). PIX
     * gerado e não pago furando a fila era a brecha do modelo antigo: prometer,
     * subir e nunca pagar.
     */
    test.each([
      [RequestBoostStatusEnum.PROMISED, false],
      [RequestBoostStatusEnum.AWAITING_PAYMENT, false],
      [RequestBoostStatusEnum.PAID, true],
      [RequestBoostStatusEnum.EXPIRED, false],
      [RequestBoostStatusEnum.CANCELLED, false],
      [RequestBoostStatusEnum.REFUND_PENDING, false],
    ])("%s destaca? %s", (status, expected) => {
      const needsCharge =
        status === RequestBoostStatusEnum.AWAITING_PAYMENT ||
        status === RequestBoostStatusEnum.PAID ||
        status === RequestBoostStatusEnum.REFUND_PENDING;
      const moneyIn =
        status === RequestBoostStatusEnum.PAID ||
        status === RequestBoostStatusEnum.REFUND_PENDING;

      const boost = new RequestBoost({
        amount: new Money(10),
        status,
        tip_id: TIP_ID,
        charged_at: needsCharge ? new Date() : null,
        paid_at: moneyIn ? new Date() : null,
      });

      expect(boost.isBoosting).toBe(expected);
    });
  });

  describe("expiresAt", () => {
    /*
     * 🔴 A janela conta do ACEITE, não da promessa. O fã promete quando faz o
     * pedido; o músico pode aceitar meia hora depois, e contar da promessa
     * entregaria um QR já vencido no instante em que o fã o recebe.
     */
    test("conta a partir da cobrança, não da promessa", () => {
      const promisedAt = new Date("2026-08-27T20:00:00.000Z");
      const chargedAt = new Date("2026-08-27T20:30:00.000Z");

      const boost = new RequestBoost({
        amount: new Money(10),
        promised_at: promisedAt,
      }).withCharge(TIP_ID, chargedAt);

      expect(boost.expiresAt(15)).toEqual(new Date("2026-08-27T20:45:00.000Z"));
    });

    test("é null fora de awaiting_payment", () => {
      expect(promised().expiresAt(15)).toBeNull();
      expect(promised().withCharge(TIP_ID).markPaid().expiresAt(15)).toBeNull();
    });
  });

  describe("isPublic", () => {
    test("só é público quando pago", () => {
      expect(promised({ dedication: "pra Ana" }).isPublic).toBe(false);
      expect(
        promised({ dedication: "pra Ana" }).withCharge(TIP_ID).isPublic,
      ).toBe(false);
      expect(
        promised({ dedication: "pra Ana" }).withCharge(TIP_ID).markPaid()
          .isPublic,
      ).toBe(true);
    });
  });
});
