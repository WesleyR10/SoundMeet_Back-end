import { IDomainEvent, Money, Uuid } from "../../../shared/domain";

export class TransactionCreatedEvent implements IDomainEvent {
  occurred_on: Date;
  event_version: number = 1;
  constructor(
    public aggregate_id: Uuid,
    public type: string,
    public amount: Money,
    public fee: Money,
    public net_amount: Money,
    public musician_id: Uuid | null,
    public user_id: Uuid | null,
  ) {
    this.occurred_on = new Date();
  }
  toJSON() {
    return {
      aggregate_id: this.aggregate_id.id,
      type: this.type,
      amount: this.amount.amount,
      fee: this.fee.amount,
      net_amount: this.net_amount.amount,
      musician_id: this.musician_id?.id ?? null,
      user_id: this.user_id?.id ?? null,
      event_version: this.event_version,
      occurred_on: this.occurred_on.toISOString(),
    };
  }
  static fromJSON(data: any): TransactionCreatedEvent {
    const event = new TransactionCreatedEvent(
      new Uuid(data.aggregate_id),
      data.type,
      new Money(data.amount),
      new Money(data.fee),
      new Money(data.net_amount),
      data.musician_id ? new Uuid(data.musician_id) : null,
      data.user_id ? new Uuid(data.user_id) : null,
    );
    event.occurred_on = new Date(data.occurred_on);
    event.event_version = data.event_version;
    return event;
  }
}
