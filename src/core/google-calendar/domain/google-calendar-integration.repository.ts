import { IRepository } from "../../shared/domain/repository/repository-interface";
import {
  GoogleCalendarIntegration,
  GoogleCalendarIntegrationId,
} from "./google-calendar-integration.aggregate";

/**
 * Lookup sempre 1:1 por músico — sem busca paginada, por isso IRepository
 * simples em vez de ISearchableRepository.
 */
export interface IGoogleCalendarIntegrationRepository extends IRepository<
  GoogleCalendarIntegration,
  GoogleCalendarIntegrationId
> {
  findByMusicianId(
    musician_id: string,
  ): Promise<GoogleCalendarIntegration | null>;
}
