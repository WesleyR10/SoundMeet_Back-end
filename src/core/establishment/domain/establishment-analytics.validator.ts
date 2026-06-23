import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { EstablishmentAnalytics } from "./establishment-analytics.read-model";

export class EstablishmentAnalyticsRules {
  @IsUUID("4", { groups: ["establishment_id"] })
  @IsNotEmpty({ groups: ["establishment_id"] })
  establishment_id: string;

  @IsDate({ groups: ["date"] })
  @IsNotEmpty({ groups: ["date"] })
  date: Date;

  @IsNumber({}, { groups: ["events_hosted"] })
  @Min(0, { groups: ["events_hosted"] })
  @IsOptional({ groups: ["events_hosted"] })
  events_hosted?: number;

  @IsNumber({}, { groups: ["total_attendees"] })
  @Min(0, { groups: ["total_attendees"] })
  @IsOptional({ groups: ["total_attendees"] })
  total_attendees?: number;

  @IsNumber({}, { groups: ["musicians_hired"] })
  @Min(0, { groups: ["musicians_hired"] })
  @IsOptional({ groups: ["musicians_hired"] })
  musicians_hired?: number;

  @IsNumber({}, { groups: ["total_spent"] })
  @Min(0, { groups: ["total_spent"] })
  @IsOptional({ groups: ["total_spent"] })
  total_spent?: number;

  @IsNumber({}, { groups: ["avg_rating"] })
  @Min(0, { groups: ["avg_rating"] })
  @Max(5, { groups: ["avg_rating"] })
  @IsOptional({ groups: ["avg_rating"] })
  avg_rating?: number;

  constructor(entity: EstablishmentAnalytics | any) {
    this.establishment_id =
      entity?.establishment_id?.id ?? entity?.establishment_id;
    this.date = entity?.date;
    this.events_hosted = entity?.events_hosted;
    this.total_attendees = entity?.total_attendees;
    this.musicians_hired = entity?.musicians_hired;
    this.total_spent = entity?.total_spent;
    this.avg_rating = entity?.avg_rating;
  }
}

export class EstablishmentAnalyticsValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "establishment_id",
          "date",
          "events_hosted",
          "total_attendees",
          "musicians_hired",
          "total_spent",
          "avg_rating",
        ];
    return super.validate(
      notification,
      new EstablishmentAnalyticsRules(data),
      newFields,
    );
  }
}

export class EstablishmentAnalyticsValidatorFactory {
  static create(): EstablishmentAnalyticsValidator {
    return new EstablishmentAnalyticsValidator();
  }
}
