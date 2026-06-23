import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { EstablishmentId } from "../../../domain/establishment.aggregate";
import {
  EstablishmentAnalytics,
  EstablishmentAnalyticsId,
} from "../../../domain/establishment-analytics.read-model";
import { EstablishmentAnalyticsModel } from "./establishment-analytics-model";

export class EstablishmentAnalyticsModelMapper {
  static toModel(entity: EstablishmentAnalytics): EstablishmentAnalyticsModel {
    return {
      id: entity.analytics_id.id,
      establishmentId: entity.establishment_id.id,
      date: entity.date,
      eventsHosted: entity.events_hosted,
      totalAttendees: entity.total_attendees,
      musiciansHired: entity.musicians_hired,
      totalSpent: entity.total_spent,
      avgRating: entity.avg_rating,
      created_at: entity.created_at,
    };
  }

  static toEntity(model: EstablishmentAnalyticsModel): EstablishmentAnalytics {
    try {
      const entity = new EstablishmentAnalytics({
        analytics_id: new EstablishmentAnalyticsId(model.id),
        establishment_id: new EstablishmentId(model.establishmentId),
        date: model.date,
        events_hosted: model.eventsHosted,
        total_attendees: model.totalAttendees,
        musicians_hired: model.musiciansHired,
        total_spent: model.totalSpent,
        avg_rating: model.avgRating,
        created_at: model.created_at,
      });

      entity.validate();
      if (entity.notification.hasErrors()) {
        throw new LoadEntityError(entity.notification.toJSON());
      }

      return entity;
    } catch (error: any) {
      throw new LoadEntityError([
        {
          establishment_analytics: [
            error?.message ?? `Invalid EstablishmentAnalytics ${model.id}`,
          ],
        },
      ]);
    }
  }
}
