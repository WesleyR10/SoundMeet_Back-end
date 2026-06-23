import { Entity, Uuid } from "../../shared/domain";
import { EstablishmentId } from "./establishment.aggregate";
import { EstablishmentAnalyticsValidatorFactory } from "./establishment-analytics.validator";
import { EstablishmentAnalyticsFakeBuilder } from "./establishment-analytics-fake.builder";

export class EstablishmentAnalyticsId extends Uuid {}

export type EstablishmentAnalyticsConstructorProps = {
  analytics_id?: EstablishmentAnalyticsId;
  establishment_id: EstablishmentId;
  date: Date;
  events_hosted?: number;
  total_attendees?: number;
  musicians_hired?: number;
  total_spent?: number;
  avg_rating?: number;
  created_at?: Date;
};

export type EstablishmentAnalyticsCreateCommand = {
  establishment_id: string;
  date: Date;
  events_hosted?: number;
  total_attendees?: number;
  musicians_hired?: number;
  total_spent?: number;
  avg_rating?: number;
};

export type EstablishmentAnalyticsUpdateCommand = {
  events_hosted?: number;
  total_attendees?: number;
  musicians_hired?: number;
  total_spent?: number;
  avg_rating?: number;
};

/**
 * Projection/read model derived from events, bookings, attendance and spending.
 * It is intentionally not an AggregateRoot; write authority remains in the
 * bounded contexts that produce the metrics.
 */
export class EstablishmentAnalytics extends Entity {
  analytics_id: EstablishmentAnalyticsId;
  establishment_id: EstablishmentId;
  date: Date;
  events_hosted: number;
  total_attendees: number;
  musicians_hired: number;
  total_spent: number;
  avg_rating: number;
  created_at: Date;

  constructor(props: EstablishmentAnalyticsConstructorProps) {
    super();
    this.analytics_id = props.analytics_id ?? new EstablishmentAnalyticsId();
    this.establishment_id = props.establishment_id;
    this.date = props.date;
    this.events_hosted = props.events_hosted ?? 0;
    this.total_attendees = props.total_attendees ?? 0;
    this.musicians_hired = props.musicians_hired ?? 0;
    this.total_spent = props.total_spent ?? 0;
    this.avg_rating = props.avg_rating ?? 0;
    this.created_at = props.created_at ?? new Date();
  }

  static create(command: EstablishmentAnalyticsCreateCommand) {
    const entity = new EstablishmentAnalytics({
      establishment_id: new EstablishmentId(command.establishment_id),
      date: command.date,
      events_hosted: command.events_hosted ?? 0,
      total_attendees: command.total_attendees ?? 0,
      musicians_hired: command.musicians_hired ?? 0,
      total_spent: command.total_spent ?? 0,
      avg_rating: command.avg_rating ?? 0,
    });
    entity.validate();
    return entity;
  }

  update(command: EstablishmentAnalyticsUpdateCommand): void {
    if (command.events_hosted !== undefined) {
      this.events_hosted = command.events_hosted;
    }
    if (command.total_attendees !== undefined) {
      this.total_attendees = command.total_attendees;
    }
    if (command.musicians_hired !== undefined) {
      this.musicians_hired = command.musicians_hired;
    }
    if (command.total_spent !== undefined) {
      this.total_spent = command.total_spent;
    }
    if (command.avg_rating !== undefined) {
      this.avg_rating = command.avg_rating;
    }
    this.validate();
  }

  validate(fields?: string[]): boolean {
    const validator = EstablishmentAnalyticsValidatorFactory.create();
    return validator.validate(this.notification, this, fields);
  }

  static fake() {
    return EstablishmentAnalyticsFakeBuilder;
  }

  get entity_id(): EstablishmentAnalyticsId {
    return this.analytics_id;
  }

  toJSON() {
    return {
      analytics_id: this.analytics_id.id,
      establishment_id: this.establishment_id.id,
      date: this.date,
      events_hosted: this.events_hosted,
      total_attendees: this.total_attendees,
      musicians_hired: this.musicians_hired,
      total_spent: this.total_spent,
      avg_rating: this.avg_rating,
      created_at: this.created_at,
    };
  }
}
