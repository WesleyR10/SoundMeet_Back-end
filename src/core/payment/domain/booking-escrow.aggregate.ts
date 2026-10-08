import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { Money } from "../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { BookingEscrowStatus } from "./booking-escrow-enums";
import { BookingEscrowFakeBuilder } from "./booking-escrow-fake.builder";
import { BookingEscrowReleasedEvent } from "./events/booking-escrow-released.event";
import { splitAmountInCents } from "./split-amount";
import { BookingEscrowValidatorFactory } from "./validators/booking-escrow.validator";

export class BookingEscrowId extends Uuid {}

export type BookingEscrowConstructorProps = {
  escrow_id?: BookingEscrowId;
  booking_id: Uuid;
  musician_id?: Uuid | null;
  amount: Money;
  platform_fee: Money;
  net_amount: Money;
  status?: BookingEscrowStatus;
  external_id?: string | null;
  expires_at?: Date | null;
  held_at?: Date | null;
  released_at?: Date | null;
  refunded_at?: Date | null;
  resolution_note?: string | null;
  created_at?: Date;
  updated_at?: Date;
};

export type BookingEscrowCreateCommand = {
  booking_id: string;
  musician_id?: string | null;
  amount: number;
  platform_fee_percentage: number;
};

/**
 * Custódia do cachê de um show (F1.3a).
 *
 * ## O dinheiro não está aqui
 *
 * Este agregado é o **registro** de uma custódia que acontece na instituição de
 * pagamento, na subconta do músico. A plataforma não detém recurso de terceiro
 * — é o que a cláusula `papel_da_plataforma.com_custodia` afirma, e ligar o
 * escrow pelo caminho do "saldo lógico numa conta nossa" transformaria cláusula
 * assinada em declaração falsa. Ver `decisoes-de-gateway.md`.
 *
 * ## A comissão só é devida na liberação
 *
 * `platform_fee` é calculada na criação para ficar congelada, mas **não é
 * receita** enquanto o status não for `released`. Show não realizado, nenhuma
 * comissão — é o argumento mais forte contra a tese de responsabilidade
 * solidária ("a plataforma lucrou com o negócio"), e está escrito na cláusula.
 */
export class BookingEscrow extends AggregateRoot {
  escrow_id: BookingEscrowId;
  booking_id: Uuid;
  musician_id: Uuid | null;
  amount: Money;
  platform_fee: Money;
  net_amount: Money;
  status: BookingEscrowStatus;
  external_id: string | null;
  /** Quando a liberação automática do provedor vence (`daysToExpire`). */
  expires_at: Date | null;
  held_at: Date | null;
  released_at: Date | null;
  refunded_at: Date | null;
  resolution_note: string | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: BookingEscrowConstructorProps) {
    super();
    this.escrow_id = props.escrow_id ?? new BookingEscrowId();
    this.booking_id = props.booking_id;
    this.musician_id = props.musician_id ?? null;
    this.amount = props.amount;
    this.platform_fee = props.platform_fee;
    this.net_amount = props.net_amount;
    this.status = props.status ?? BookingEscrowStatus.PENDING;
    this.external_id = props.external_id ?? null;
    this.expires_at = props.expires_at ?? null;
    this.held_at = props.held_at ?? null;
    this.released_at = props.released_at ?? null;
    this.refunded_at = props.refunded_at ?? null;
    this.resolution_note = props.resolution_note ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): BookingEscrowId {
    return this.escrow_id;
  }

  /**
   * A comissão é calculada UMA vez, na criação, e congelada.
   *
   * Recalcular na liberação faria uma mudança de tabela de preços alcançar um
   * show já contratado — exatamente o que a âncora "vigente na data de emissão"
   * do contrato existe para impedir.
   */
  static create(command: BookingEscrowCreateCommand): BookingEscrow {
    const { amount, platform_fee, net_amount } = BookingEscrow.splitAmount(
      command.amount,
      command.platform_fee_percentage,
    );

    const escrow = new BookingEscrow({
      booking_id: new Uuid(command.booking_id),
      musician_id: command.musician_id ? new Uuid(command.musician_id) : null,
      amount,
      platform_fee,
      net_amount,
    });

    escrow.validate();
    return escrow;
  }

  /**
   * A divisão bruto → comissão + líquido, em centavos inteiros.
   *
   * Delega para `splitAmountInCents`, que serve também à comissão da gorjeta —
   * a armadilha de ponto flutuante é a mesma nos dois vértices, e duplicar a
   * conta seria garantir que uma das duas divergisse.
   */
  static splitAmount(
    amount: number,
    feePercentage: number,
  ): { amount: Money; platform_fee: Money; net_amount: Money } {
    return splitAmountInCents(amount, feePercentage);
  }

  /**
   * A cobrança foi criada no provedor e **aguarda pagamento**.
   *
   * Separado de `markHeld` de propósito: aqui existe um boleto/PIX esperando o
   * estabelecimento pagar; lá o dinheiro entrou e está retido. Fundir os dois
   * faria o `held_balance` do músico subir no instante em que a cobrança é
   * gerada — anunciando como retido um valor que ninguém pagou ainda.
   *
   * Idempotente pela mesma razão de `markHeld`: reexecutar a criação depois de
   * uma falha parcial não pode gerar uma segunda cobrança para o mesmo show, e
   * é o `external_id` já gravado que permite ao chamador detectar isso.
   */
  attachCharge(command: {
    external_id: string;
    expires_at?: Date | null;
    at?: Date;
  }): void {
    if (!command.external_id?.trim()) {
      this.notification.addError(
        "external_id é obrigatório para registrar a cobrança",
        "external_id",
      );
      return;
    }

    if (this.status !== BookingEscrowStatus.PENDING) {
      this.notification.addError(
        `Não é possível registrar cobrança numa custódia ${this.status}`,
        "status",
      );
      return;
    }

    const externalId = command.external_id.trim();

    if (this.external_id !== null) {
      if (this.external_id === externalId) return; // reexecução
      this.notification.addError(
        "Custódia já tem cobrança registrada com outra referência do provedor",
        "external_id",
      );
      return;
    }

    const now = command.at ?? new Date();
    this.external_id = externalId;
    this.expires_at = command.expires_at ?? null;
    this.updated_at = now;
  }

  /**
   * O pagamento entrou e ficou retido no provedor.
   *
   * `external_id` é obrigatório: sem a referência da cobrança no provedor não
   * há como liberar nem estornar depois, e a custódia viraria dinheiro sem
   * dono operável. Idempotente contra reentrega de webhook — repetir `markHeld`
   * com o MESMO `external_id` é no-op em vez de erro, porque webhook duplicado
   * é o caso normal, não a exceção.
   */
  markHeld(command: {
    external_id: string;
    expires_at?: Date | null;
    at?: Date;
  }): void {
    if (!command.external_id?.trim()) {
      this.notification.addError(
        "external_id é obrigatório para reter a custódia",
        "external_id",
      );
      return;
    }

    if (this.status === BookingEscrowStatus.HELD) {
      if (this.external_id === command.external_id.trim()) return; // reentrega
      this.notification.addError(
        "Custódia já retida com outra referência do provedor",
        "external_id",
      );
      return;
    }

    if (this.status !== BookingEscrowStatus.PENDING) {
      this.notification.addError(
        `Não é possível reter uma custódia ${this.status}`,
        "status",
      );
      return;
    }

    const externalId = command.external_id.trim();

    /*
     * A cobrança já registrada por `attachCharge` é a âncora: um webhook que
     * chega com OUTRA referência não é o pagamento desta custódia. Sobrescrever
     * marcaria como retido o dinheiro de uma cobrança alheia e deixaria a
     * original órfã — sem ninguém para liberar nem estornar.
     */
    if (this.external_id !== null && this.external_id !== externalId) {
      this.notification.addError(
        "Custódia já tem cobrança registrada com outra referência do provedor",
        "external_id",
      );
      return;
    }

    const now = command.at ?? new Date();
    this.status = BookingEscrowStatus.HELD;
    this.external_id = externalId;
    this.expires_at = command.expires_at ?? this.expires_at;
    this.held_at = now;
    this.updated_at = now;
  }

  /**
   * Libera para o músico.
   *
   * Aceita `held` (caminho feliz) **e** `disputed` (mediação decidiu a favor do
   * artista). Repetir sobre uma custódia já liberada é no-op: o job de
   * liberação e o webhook do provedor podem chegar os dois, e transformar isso
   * em erro encheria o log de falha onde não houve nenhuma.
   */
  release(command: { at?: Date; note?: string | null } = {}): void {
    if (this.status === BookingEscrowStatus.RELEASED) return;

    if (
      this.status !== BookingEscrowStatus.HELD &&
      this.status !== BookingEscrowStatus.DISPUTED
    ) {
      this.notification.addError(
        `Não é possível liberar uma custódia ${this.status}`,
        "status",
      );
      return;
    }

    const now = command.at ?? new Date();
    this.status = BookingEscrowStatus.RELEASED;
    this.released_at = now;
    this.updated_at = now;
    if (command.note) this.resolution_note = command.note;

    this.applyEvent(
      new BookingEscrowReleasedEvent({
        escrow_id: this.escrow_id,
        booking_id: this.booking_id,
        musician_id: this.musician_id,
        net_amount: this.net_amount.amount,
        platform_fee: this.platform_fee.amount,
        released_at: now,
      }),
    );
  }

  /**
   * Devolve ao estabelecimento.
   *
   * `reason` é obrigatório: estorno sem justificativa registrada é o tipo de
   * lançamento que ninguém consegue explicar seis meses depois, num subsistema
   * cuja razão de existir é produzir prova.
   */
  refund(command: { reason: string; at?: Date }): void {
    if (this.status === BookingEscrowStatus.REFUNDED) return;

    if (!command.reason?.trim()) {
      this.notification.addError(
        "Estorno de custódia exige motivo registrado",
        "resolution_note",
      );
      return;
    }

    if (
      this.status !== BookingEscrowStatus.HELD &&
      this.status !== BookingEscrowStatus.DISPUTED &&
      this.status !== BookingEscrowStatus.PENDING
    ) {
      this.notification.addError(
        `Não é possível estornar uma custódia ${this.status}`,
        "status",
      );
      return;
    }

    const now = command.at ?? new Date();
    this.status = BookingEscrowStatus.REFUNDED;
    this.refunded_at = now;
    this.resolution_note = command.reason.trim();
    this.updated_at = now;
  }

  /**
   * Contestação do estabelecimento: congela a liberação automática.
   *
   * Só a partir de `held` — contestar o que ainda não entrou não faz sentido, e
   * contestar o que já saiu é tarde: o dinheiro está na conta do músico e a
   * discussão deixa de ser de custódia.
   */
  dispute(command: { reason: string; at?: Date }): void {
    if (!command.reason?.trim()) {
      this.notification.addError("Contestação exige motivo", "resolution_note");
      return;
    }

    if (this.status !== BookingEscrowStatus.HELD) {
      this.notification.addError(
        `Não é possível contestar uma custódia ${this.status}`,
        "status",
      );
      return;
    }

    const now = command.at ?? new Date();
    this.status = BookingEscrowStatus.DISPUTED;
    this.resolution_note = command.reason.trim();
    this.updated_at = now;
  }

  /** Está retida e disponível para o job avaliar? */
  get isHeld(): boolean {
    return this.status === BookingEscrowStatus.HELD;
  }

  get isSettled(): boolean {
    return (
      this.status === BookingEscrowStatus.RELEASED ||
      this.status === BookingEscrowStatus.REFUNDED
    );
  }

  validate(fields?: string[]): boolean {
    const validator = BookingEscrowValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return BookingEscrowFakeBuilder;
  }

  toJSON() {
    return {
      escrow_id: this.escrow_id.id,
      booking_id: this.booking_id.id,
      musician_id: this.musician_id?.id ?? null,
      amount: this.amount.amount,
      platform_fee: this.platform_fee.amount,
      net_amount: this.net_amount.amount,
      status: this.status,
      external_id: this.external_id,
      expires_at: this.expires_at,
      held_at: this.held_at,
      released_at: this.released_at,
      refunded_at: this.refunded_at,
      resolution_note: this.resolution_note,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
