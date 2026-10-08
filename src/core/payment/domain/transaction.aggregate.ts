import { AggregateRoot } from "../../shared/domain/aggregate-root";
import { Money } from "../../shared/domain/value-objects/money.vo";
import { Uuid } from "../../shared/domain/value-objects/uuid.vo";
import { TransactionCreatedEvent } from "./events/transaction-created.event";
import { PaymentMethod } from "./tip-enums";
import { TransactionStatus, TransactionType } from "./transaction-enums";
import { TransactionFakeBuilder } from "./transaction-fake.builder";
import { TransactionValidatorFactory } from "./validators/transaction.validator";

export type TransactionConstructorProps = {
  transaction_id?: TransactionId;
  user_id?: Uuid | null;
  musician_id?: Uuid | null;
  band_id?: Uuid | null;
  type: TransactionType;
  amount: Money;
  fee: Money;
  net_amount: Money;
  status?: TransactionStatus;
  payment_method: PaymentMethod;
  external_id?: string | null;
  idempotency_key?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: Date;
  updated_at?: Date;
};

export type TransactionCreateCommand = {
  user_id?: string | null;
  musician_id?: string | null;
  band_id?: string | null;
  type: TransactionType;
  amount: number;
  fee?: number;
  payment_method: PaymentMethod;
  external_id?: string | null;
  /**
   * Chave do CLIENTE (header `Idempotency-Key`). Distinta de `external_id`,
   * que é do provedor e só existe depois da chamada — por isso as duas
   * coexistem: a primeira identifica a INTENÇÃO, a segunda o EFEITO.
   */
  idempotency_key?: string | null;
  metadata?: Record<string, any> | null;
};

export class TransactionId extends Uuid {}

export class Transaction extends AggregateRoot {
  transaction_id: TransactionId;
  user_id: Uuid | null;
  musician_id: Uuid | null;
  band_id: Uuid | null;
  type: TransactionType;
  amount: Money;
  fee: Money;
  net_amount: Money;
  status: TransactionStatus;
  payment_method: PaymentMethod;
  external_id: string | null;
  idempotency_key: string | null;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: TransactionConstructorProps) {
    super();
    this.transaction_id = props.transaction_id ?? new TransactionId();
    this.user_id = props.user_id ?? null;
    this.musician_id = props.musician_id ?? null;
    this.band_id = props.band_id ?? null;
    this.type = props.type;
    this.amount = props.amount;
    this.fee = props.fee;
    this.net_amount = props.net_amount;
    this.status = props.status ?? TransactionStatus.PENDING;
    this.payment_method = props.payment_method;
    this.external_id = props.external_id ?? null;
    this.idempotency_key = props.idempotency_key ?? null;
    this.metadata = props.metadata ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): TransactionId {
    return this.transaction_id;
  }

  /** Ainda aguarda desfecho no provedor — nem concluída, nem falha, nem estornada. */
  get isPending(): boolean {
    return this.status === TransactionStatus.PENDING;
  }

  static create(command: TransactionCreateCommand): Transaction {
    const amount = new Money(command.amount);
    const fee = new Money(command.fee ?? 0);
    /*
     * 🔴 `command.amount - command.fee` em ponto flutuante, como era aqui,
     * quebra com valores comuns: um cachê de R$1.111,10 com 10% de comissão
     * dava `999.9899999999999`, e o `Money` recusa mais de duas casas — a
     * transação nascia inválida e a confirmação do pagamento falhava com o
     * dinheiro já aprovado no gateway. `subtract` opera em centavos inteiros.
     */
    const net_amount = amount.subtract(fee);

    const transaction = new Transaction({
      user_id: command.user_id ? new Uuid(command.user_id) : null,
      musician_id: command.musician_id ? new Uuid(command.musician_id) : null,
      band_id: command.band_id ? new Uuid(command.band_id) : null,
      type: command.type,
      amount,
      fee,
      net_amount,
      payment_method: command.payment_method,
      external_id: command.external_id,
      idempotency_key: command.idempotency_key ?? null,
      metadata: command.metadata,
    });

    transaction.validate();
    transaction.applyEvent(
      new TransactionCreatedEvent(
        transaction.transaction_id,
        transaction.type,
        transaction.amount,
        transaction.fee,
        transaction.net_amount,
        transaction.musician_id,
        transaction.user_id,
      ),
    );
    return transaction;
  }

  validate(fields?: string[]): boolean {
    const validator = TransactionValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return TransactionFakeBuilder;
  }

  complete(): void {
    this.status = TransactionStatus.COMPLETED;
    this.updated_at = new Date();
  }

  /**
   * `reason` é registrado em `metadata.failure_reason`.
   *
   * Um saque que falhou e devolveu saldo é exatamente o lançamento que alguém
   * vai pedir para explicar — do músico que viu o dinheiro voltar ao suporte
   * reconstruindo o extrato. Sem o motivo gravado no próprio lançamento, a
   * resposta depende de correlacionar log com timestamp.
   */
  fail(reason?: string): void {
    this.status = TransactionStatus.FAILED;
    if (reason?.trim()) {
      this.metadata = { ...(this.metadata ?? {}), failure_reason: reason };
    }
    this.updated_at = new Date();
  }

  /**
   * Registra o identificador que o provedor devolveu para esta transação.
   *
   * Existe para que o `external_id` deixe de ser atribuído por fora
   * (`tx.external_id = result.transfer_id` no use-case do saque): é o campo
   * pelo qual o webhook reencontra a transação, e a coluna é UNIQUE. Vincular
   * duas vezes a mesma transação a transferências diferentes deixaria a
   * primeira órfã — nenhum webhook a completaria, e o saldo ficaria debitado
   * sem contrapartida. Por isso o método é no-op quando o vínculo já existe e
   * bate, e recusa quando difere.
   */
  linkExternalId(externalId: string): void {
    const value = externalId?.trim();
    if (!value) {
      this.notification.addError(
        "external_id não pode ser vazio",
        "external_id",
      );
      return;
    }
    if (this.external_id !== null) {
      if (this.external_id !== value) {
        this.notification.addError(
          "Transação já vinculada a outro identificador externo",
          "external_id",
        );
      }
      return;
    }

    this.external_id = value;
    this.updated_at = new Date();
  }

  toJSON() {
    return {
      transaction_id: this.transaction_id.id,
      user_id: this.user_id?.id ?? null,
      musician_id: this.musician_id?.id ?? null,
      band_id: this.band_id?.id ?? null,
      type: this.type,
      amount: this.amount.amount,
      fee: this.fee.amount,
      net_amount: this.net_amount.amount,
      status: this.status,
      payment_method: this.payment_method,
      external_id: this.external_id,
      idempotency_key: this.idempotency_key,
      metadata: this.metadata,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
