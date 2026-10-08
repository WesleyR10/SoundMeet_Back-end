import { PrismaClient } from "@prisma/client";

import { resolveVenueTimezone } from "../../../shared/domain/brazil-timezone";
import { IVenueLocationPort, VenueCoordinates } from "../../domain/presence";

/**
 * Lê as colunas denormalizadas `location_lat/lng` do perfil da casa — as
 * mesmas que a busca por proximidade usa (`@@index([location_lat,
 * location_lng])`). A fonte de verdade é o JSON `location`; as colunas são
 * preenchidas pelo mapper a cada gravação, e `null` significa "geocoding não
 * resolveu", que o `PresenceVerifier` trata como `venue_without_coords`.
 */
export class VenueLocationPrismaAdapter implements IVenueLocationPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findVenueCoordinates(
    establishment_id: string,
  ): Promise<VenueCoordinates | null> {
    const profile = await this.prisma.establishmentProfile.findUnique({
      where: { establishmentId: establishment_id },
      select: { location_lat: true, location_lng: true },
    });

    if (
      !profile ||
      profile.location_lat === null ||
      profile.location_lng === null
    ) {
      return null;
    }

    return { latitude: profile.location_lat, longitude: profile.location_lng };
  }

  async findVenueTimezone(establishment_id: string): Promise<string> {
    const profile = await this.prisma.establishmentProfile.findUnique({
      where: { establishmentId: establishment_id },
      select: { location: true, operatingHours: true },
    });
    const location = asRecord(profile?.location);
    const hours = asRecord(profile?.operatingHours);
    return resolveVenueTimezone({
      state: asString(location?.state),
      city: asString(location?.city),
      declared_timezone: asString(hours?.timezone),
    });
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
