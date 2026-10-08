import { InvalidArgumentError } from "../../../shared/domain/errors/invalid-argument.error";
import { ValueObject } from "../../../shared/domain/value-object";
import { Money } from "../../../shared/domain/value-objects/money.vo";

/**
 * Ciclo de vida do destaque pago de um pedido musical.
 *
 * 🔴 **PAGA ANTES, destaca DEPOIS** (decisão de 28/set/2026). A cobrança
 * nasce quando o fã FAZ o pedido, e o pedido só sobe na fila quando o PIX é
 * confirmado. O modelo anterior (cobrar no aceite) deixava prometer R$20,
 * furar a fila e nunca pagar — a promessa não paga destacava a triagem inteira
 * e ficava "a confirmar" na frente dos pedidos comuns.
 *
 * O preço: dinheiro pode chegar para pedido que o músico RECUSA. Esse caso vira
 * `refund_pending` e para aí — o reembolso de fato (e onde o dinheiro fica
 * retido até o pedido ser tocado) é tarefa aberta: ver
 * `Docs/funcionalidades/reembolso-do-destaque-pago.md`.
 */
export enum RequestBoostStatusEnum {
  /**
   * Valor escolhido, cobrança AINDA NÃO criada. Transitório: vive só dentro
   * do `CreateRequestUseCase`, entre a validação e o PIX. Linhas antigas (do
   * modelo "cobra no aceite") ainda podem tê-lo — e são canceladas no aceite.
   */
  PROMISED = "promised",
  /** PIX criado junto com o pedido; o fã ainda não pagou. NÃO destaca. */
  AWAITING_PAYMENT = "awaiting_payment",
  /** Webhook confirmou. Destaca a fila, e a dedicatória vai a público. */
  PAID = "paid",
  /** A janela venceu sem pagamento. O pedido segue como pedido comum. */
  EXPIRED = "expired",
  /** Pedido recusado antes do pagamento (ou promessa antiga). Não destaca. */
  CANCELLED = "cancelled",
  /**
   * Houve DINHEIRO e o pedido foi recusado (pagou e o músico recusou, ou pagou
   * depois da recusa). Precisa voltar ao fã. Terminal até o reembolso existir.
   */
  REFUND_PENDING = "refund_pending",
}

/**
 * Transições legais. Qualquer par fora deste mapa é `InvalidArgumentError`.
 *
 * `paid`, `expired` e `cancelled` são terminais de propósito: são os três
 * estados em que já houve (ou já não haverá) dinheiro, e reabrir qualquer um
 * deles significaria cobrar de novo ou destacar um pedido que ninguém pagou.
 */
const LEGAL_TRANSITIONS: Record<
  RequestBoostStatusEnum,
  readonly RequestBoostStatusEnum[]
> = {
  [RequestBoostStatusEnum.PROMISED]: [
    RequestBoostStatusEnum.AWAITING_PAYMENT,
    RequestBoostStatusEnum.CANCELLED,
  ],
  [RequestBoostStatusEnum.AWAITING_PAYMENT]: [
    RequestBoostStatusEnum.PAID,
    RequestBoostStatusEnum.EXPIRED,
    RequestBoostStatusEnum.CANCELLED,
  ],
  // Pagou e o pedido foi recusado depois.
  [RequestBoostStatusEnum.PAID]: [RequestBoostStatusEnum.REFUND_PENDING],
  // PIX pago FORA da janela: vale se o pedido ainda está aberto; se já foi
  // recusado, o dinheiro tem de voltar.
  [RequestBoostStatusEnum.EXPIRED]: [
    RequestBoostStatusEnum.PAID,
    RequestBoostStatusEnum.REFUND_PENDING,
  ],
  // O QR continua pagável depois da recusa — o dinheiro que chegar volta.
  [RequestBoostStatusEnum.CANCELLED]: [RequestBoostStatusEnum.REFUND_PENDING],
  [RequestBoostStatusEnum.REFUND_PENDING]: [],
};

/**
 * Estados em que o destaque vale — ou seja, em que o pedido sobe na fila.
 *
 * 🔴 SÓ `paid`. PIX gerado e não pago não fura fila de ninguém: é a brecha
 * que o modelo antigo tinha (prometer, subir e sumir). ⚠️ O `ORDER BY` do
 * repositório Prisma repete esta regra em SQL — mexeu num, mexa no outro.
 */
const BOOSTING_STATUSES: readonly RequestBoostStatusEnum[] = [
  RequestBoostStatusEnum.PAID,
];

/** Estados em que já entrou dinheiro — exigem `tip_id`, `charged_at` e `paid_at`. */
const MONEY_IN_STATUSES: readonly RequestBoostStatusEnum[] = [
  RequestBoostStatusEnum.PAID,
  RequestBoostStatusEnum.REFUND_PENDING,
];

export type RequestBoostProps = {
  amount: Money;
  dedication?: string | null;
  status?: RequestBoostStatusEnum;
  tip_id?: string | null;
  promised_at?: Date;
  /**
   * Quando o PIX foi criado — hoje, no instante do pedido. É daqui que a
   * janela de pagamento conta.
   */
  charged_at?: Date | null;
  paid_at?: Date | null;
  /** Preenchido quando vai para `cancelled`, para a UI explicar o porquê. */
  cancellation_reason?: string | null;
};

export const REQUEST_BOOST_DEDICATION_MAX_LENGTH = 140;

/**
 * O destaque pago de um pedido musical: quanto o fã prometeu, para quem
 * dedicou, e em que ponto do ciclo de cobrança isso está.
 *
 * **Imutável.** Toda transição devolve uma instância nova — mesmo idioma do
 * `QRCode` VO, que é substituído inteiro em `Musician.customizeQRCode` em vez
 * de mutado no lugar.
 */
export class RequestBoost extends ValueObject {
  readonly amount: Money;
  readonly dedication: string | null;
  readonly status: RequestBoostStatusEnum;
  readonly tip_id: string | null;
  readonly promised_at: Date;
  readonly charged_at: Date | null;
  readonly paid_at: Date | null;
  readonly cancellation_reason: string | null;

  constructor(props: RequestBoostProps) {
    super();
    this.amount = props.amount;
    this.dedication = props.dedication?.trim() || null;
    this.status = props.status ?? RequestBoostStatusEnum.PROMISED;
    this.tip_id = props.tip_id ?? null;
    this.promised_at = props.promised_at ?? new Date();
    this.charged_at = props.charged_at ?? null;
    this.paid_at = props.paid_at ?? null;
    this.cancellation_reason = props.cancellation_reason ?? null;
    this.validate();
  }

  private validate(): void {
    if (this.amount.amount <= 0) {
      throw new InvalidArgumentError("Boost amount must be greater than zero");
    }

    if (!Object.values(RequestBoostStatusEnum).includes(this.status)) {
      throw new InvalidArgumentError(`Invalid boost status: ${this.status}`);
    }

    if (
      this.dedication !== null &&
      this.dedication.length > REQUEST_BOOST_DEDICATION_MAX_LENGTH
    ) {
      throw new InvalidArgumentError(
        `Dedication cannot exceed ${REQUEST_BOOST_DEDICATION_MAX_LENGTH} characters`,
      );
    }

    /*
     * Sem `tip_id` não existe cobrança, e sem cobrança não há como estar
     * esperando pagamento nem ter sido pago. Barrar aqui impede o estado mais
     * perigoso do fluxo: um destaque que se diz pago sem nada no provedor.
     */
    if (
      (this.status === RequestBoostStatusEnum.AWAITING_PAYMENT ||
        MONEY_IN_STATUSES.includes(this.status)) &&
      !this.tip_id
    ) {
      throw new InvalidArgumentError(
        `Boost in status "${this.status}" requires a tip_id`,
      );
    }

    if (MONEY_IN_STATUSES.includes(this.status) && !this.paid_at) {
      throw new InvalidArgumentError(
        `Boost in status "${this.status}" requires paid_at`,
      );
    }

    // Mesma razão do `tip_id`: sem o instante da cobrança não há como saber
    // quando ela vence, e um destaque sem prazo nunca sairia da fila.
    if (
      (this.status === RequestBoostStatusEnum.AWAITING_PAYMENT ||
        MONEY_IN_STATUSES.includes(this.status)) &&
      !this.charged_at
    ) {
      throw new InvalidArgumentError(
        `Boost in status "${this.status}" requires charged_at`,
      );
    }
  }

  /** O destaque conta na ordenação da fila? */
  get isBoosting(): boolean {
    return BOOSTING_STATUSES.includes(this.status);
  }

  /**
   * 🔴 O único portão da dedicatória pública: só depois de PAGA. Nunca de
   * quem gerou o PIX e não pagou, nem de pedido recusado (`refund_pending`).
   */
  get isPublic(): boolean {
    return this.status === RequestBoostStatusEnum.PAID;
  }

  get isPaid(): boolean {
    return this.status === RequestBoostStatusEnum.PAID;
  }

  get isAwaitingPayment(): boolean {
    return this.status === RequestBoostStatusEnum.AWAITING_PAYMENT;
  }

  get isPromised(): boolean {
    return this.status === RequestBoostStatusEnum.PROMISED;
  }

  get isExpired(): boolean {
    return this.status === RequestBoostStatusEnum.EXPIRED;
  }

  get isCancelled(): boolean {
    return this.status === RequestBoostStatusEnum.CANCELLED;
  }

  get isRefundPending(): boolean {
    return this.status === RequestBoostStatusEnum.REFUND_PENDING;
  }

  private transitionTo(
    next: RequestBoostStatusEnum,
    props: Partial<RequestBoostProps> = {},
  ): RequestBoost {
    if (!LEGAL_TRANSITIONS[this.status].includes(next)) {
      throw new InvalidArgumentError(
        `Cannot transition boost from "${this.status}" to "${next}"`,
      );
    }

    return new RequestBoost({
      amount: this.amount,
      dedication: this.dedication,
      tip_id: this.tip_id,
      promised_at: this.promised_at,
      charged_at: this.charged_at,
      paid_at: this.paid_at,
      cancellation_reason: this.cancellation_reason,
      ...props,
      status: next,
    });
  }

  /** O PIX do destaque foi criado no provedor (no instante do pedido). */
  withCharge(tipId: string, chargedAt?: Date): RequestBoost {
    if (!tipId?.trim()) {
      throw new InvalidArgumentError("tip_id is required to charge a boost");
    }
    return this.transitionTo(RequestBoostStatusEnum.AWAITING_PAYMENT, {
      tip_id: tipId.trim(),
      charged_at: chargedAt ?? new Date(),
    });
  }

  /**
   * Webhook confirmou o pagamento com o pedido AINDA ABERTO. Passa a destacar
   * e a dedicatória vira pública. Vale também para PIX pago fora da janela
   * (`expired`): o fã pagou, e o pedido continua na mesa do músico.
   */
  markPaid(paidAt?: Date): RequestBoost {
    return this.transitionTo(RequestBoostStatusEnum.PAID, {
      paid_at: paidAt ?? new Date(),
    });
  }

  /** A janela de pagamento venceu sem PIX. O pedido segue como pedido comum. */
  markExpired(): RequestBoost {
    return this.transitionTo(RequestBoostStatusEnum.EXPIRED);
  }

  /** Pedido recusado ANTES do pagamento (ou promessa antiga). Nada entrou. */
  cancel(reason?: string): RequestBoost {
    return this.transitionTo(RequestBoostStatusEnum.CANCELLED, {
      cancellation_reason: reason?.trim() || null,
    });
  }

  /**
   * Entrou dinheiro para um pedido que não vai acontecer: pagou e foi
   * recusado, ou pagou depois da recusa. `paidAt` só é exigido quando o
   * pagamento chega agora (vindo de `cancelled`/`expired`); de `paid` o
   * instante já está registrado.
   */
  markRefundPending(reason: string, paidAt?: Date): RequestBoost {
    return this.transitionTo(RequestBoostStatusEnum.REFUND_PENDING, {
      paid_at: this.paid_at ?? paidAt ?? new Date(),
      cancellation_reason: reason.trim() || this.cancellation_reason,
    });
  }

  /**
   * Quando o destaque deixa de valer se ninguém pagar.
   *
   * `null` fora de `awaiting_payment`: em `promised` não há cobrança para
   * vencer, e nos estados terminais o prazo já não decide nada.
   */
  expiresAt(windowMinutes: number): Date | null {
    if (!this.isAwaitingPayment || !this.charged_at) {
      return null;
    }
    return new Date(this.charged_at.getTime() + windowMinutes * 60 * 1000);
  }

  toJSON() {
    return {
      amount: this.amount.amount,
      dedication: this.dedication,
      status: this.status,
      tip_id: this.tip_id,
      promised_at: this.promised_at,
      charged_at: this.charged_at,
      paid_at: this.paid_at,
      cancellation_reason: this.cancellation_reason,
      is_boosting: this.isBoosting,
      is_public: this.isPublic,
    };
  }
}
