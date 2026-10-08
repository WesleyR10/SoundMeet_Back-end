import { DEFAULT_BRAZIL_TIMEZONE } from "../../../shared/domain/brazil-timezone";
import { IVenueLocationPort, VenueCoordinates } from "../../domain/presence";

export class VenueLocationInMemoryAdapter implements IVenueLocationPort {
  private readonly venues = new Map<string, VenueCoordinates>();
  private readonly timezones = new Map<string, string>();

  set(establishment_id: string, coords: VenueCoordinates | null): void {
    if (coords) {
      this.venues.set(establishment_id, coords);
    } else {
      this.venues.delete(establishment_id);
    }
  }

  async findVenueCoordinates(
    establishment_id: string,
  ): Promise<VenueCoordinates | null> {
    return this.venues.get(establishment_id) ?? null;
  }

  setTimezone(establishment_id: string, timezone: string): void {
    this.timezones.set(establishment_id, timezone);
  }

  async findVenueTimezone(establishment_id: string): Promise<string> {
    return this.timezones.get(establishment_id) ?? DEFAULT_BRAZIL_TIMEZONE;
  }
}
