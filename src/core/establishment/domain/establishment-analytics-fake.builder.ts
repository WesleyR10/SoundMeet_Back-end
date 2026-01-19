import Chance from "chance";

import { EstablishmentId } from "./establishment.aggregate";
import {
  EstablishmentAnalytics,
  EstablishmentAnalyticsConstructorProps,
  EstablishmentAnalyticsId,
} from "./establishment-analytics.entity";

type PropOrFactory<T> = T | ((index: number) => T);

export class EstablishmentAnalyticsFakeBuilder {
  private count = 1;
  private chance: Chance.Chance;

  private analytics_id: PropOrFactory<EstablishmentAnalyticsId> | undefined =
    undefined;
  private establishment_id: PropOrFactory<EstablishmentId> | undefined =
    undefined;
  private date: PropOrFactory<Date> | undefined = undefined;
  private events_hosted: PropOrFactory<number> | undefined = undefined;
  private total_attendees: PropOrFactory<number> | undefined = undefined;
  private musicians_hired: PropOrFactory<number> | undefined = undefined;
  private total_spent: PropOrFactory<number> | undefined = undefined;
  private avg_rating: PropOrFactory<number> | undefined = undefined;
  private created_at: PropOrFactory<Date> | undefined = undefined;

  private constructor(count = 1) {
    this.count = count;
    this.chance = Chance();
  }

  static anAnalytics() {
    return new EstablishmentAnalyticsFakeBuilder();
  }

  static theAnalytics(count = 2) {
    return new EstablishmentAnalyticsFakeBuilder(count);
  }

  withEstablishmentId(value: PropOrFactory<EstablishmentId>) {
    this.establishment_id = value;
    return this;
  }

  withDate(value: PropOrFactory<Date>) {
    this.date = value;
    return this;
  }

  withEventsHosted(value: PropOrFactory<number>) {
    this.events_hosted = value;
    return this;
  }

  withTotalAttendees(value: PropOrFactory<number>) {
    this.total_attendees = value;
    return this;
  }

  withMusiciansHired(value: PropOrFactory<number>) {
    this.musicians_hired = value;
    return this;
  }

  withTotalSpent(value: PropOrFactory<number>) {
    this.total_spent = value;
    return this;
  }

  withAvgRating(value: PropOrFactory<number>) {
    this.avg_rating = value;
    return this;
  }

  build(): EstablishmentAnalytics | EstablishmentAnalytics[] {
    const analytics = new Array(this.count).fill(undefined).map((_, index) => {
      const props: EstablishmentAnalyticsConstructorProps = {
        analytics_id:
          typeof this.analytics_id === "function"
            ? this.analytics_id(index)
            : (this.analytics_id ?? new EstablishmentAnalyticsId()),
        establishment_id:
          typeof this.establishment_id === "function"
            ? this.establishment_id(index)
            : (this.establishment_id ?? new EstablishmentId()),
        date:
          typeof this.date === "function"
            ? this.date(index)
            : (this.date ?? new Date("2024-01-01T00:00:00.000Z")),
        events_hosted:
          typeof this.events_hosted === "function"
            ? this.events_hosted(index)
            : (this.events_hosted ?? this.chance.integer({ min: 0, max: 10 })),
        total_attendees:
          typeof this.total_attendees === "function"
            ? this.total_attendees(index)
            : (this.total_attendees ??
              this.chance.integer({ min: 0, max: 500 })),
        musicians_hired:
          typeof this.musicians_hired === "function"
            ? this.musicians_hired(index)
            : (this.musicians_hired ??
              this.chance.integer({ min: 0, max: 10 })),
        total_spent:
          typeof this.total_spent === "function"
            ? this.total_spent(index)
            : (this.total_spent ??
              this.chance.floating({ min: 0, max: 10000, fixed: 2 })),
        avg_rating:
          typeof this.avg_rating === "function"
            ? this.avg_rating(index)
            : (this.avg_rating ?? this.chance.floating({ min: 0, max: 5 })),
        created_at:
          typeof this.created_at === "function"
            ? this.created_at(index)
            : (this.created_at ?? new Date()),
      };

      return new EstablishmentAnalytics(props);
    });

    return this.count === 1 ? analytics[0] : analytics;
  }
}
