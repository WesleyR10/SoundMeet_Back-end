import { Transform } from "class-transformer";

import {
  EstablishmentAnalyticsOutput,
  ListEstablishmentAnalyticsOutput,
} from "../../core/establishment/application/use-cases/list-establishment-analytics/list-establishment-analytics.use-case";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class EstablishmentAnalyticsPresenter {
  id: string;
  establishment_id: string;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  date: Date;
  events_hosted: number;
  total_attendees: number;
  musicians_hired: number;
  total_spent: number;
  avg_rating: number;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;

  constructor(output: EstablishmentAnalyticsOutput) {
    this.id = output.id;
    this.establishment_id = output.establishment_id;
    this.date = output.date;
    this.events_hosted = output.events_hosted;
    this.total_attendees = output.total_attendees;
    this.musicians_hired = output.musicians_hired;
    this.total_spent = output.total_spent;
    this.avg_rating = output.avg_rating;
    this.created_at = output.created_at;
  }
}

export class EstablishmentAnalyticsCollectionPresenter extends CollectionPresenter {
  data: EstablishmentAnalyticsPresenter[];

  constructor(output: ListEstablishmentAnalyticsOutput) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new EstablishmentAnalyticsPresenter(i));
  }
}
