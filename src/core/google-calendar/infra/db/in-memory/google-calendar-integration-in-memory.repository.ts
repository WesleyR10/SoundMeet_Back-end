import { InMemoryRepository } from "../../../../shared/infra/db/in-memory/in-memory.repository";
import {
  GoogleCalendarIntegration,
  GoogleCalendarIntegrationId,
} from "../../../domain/google-calendar-integration.aggregate";
import { IGoogleCalendarIntegrationRepository } from "../../../domain/google-calendar-integration.repository";

export class GoogleCalendarIntegrationInMemoryRepository
  extends InMemoryRepository<
    GoogleCalendarIntegration,
    GoogleCalendarIntegrationId
  >
  implements IGoogleCalendarIntegrationRepository
{
  getEntity(): new (...args: any[]) => GoogleCalendarIntegration {
    return GoogleCalendarIntegration;
  }

  async findByMusicianId(
    musician_id: string,
  ): Promise<GoogleCalendarIntegration | null> {
    return (
      this.items.find((item) => item.musician_id.id === musician_id) ?? null
    );
  }
}
