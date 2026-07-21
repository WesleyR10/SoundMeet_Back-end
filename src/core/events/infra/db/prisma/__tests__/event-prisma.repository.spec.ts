import { PrismaClient } from "@prisma/client";

import { EventSearchParams } from "../../../../domain/event.repository";
import { EventPrismaRepository } from "../event-prisma.repository";

// Busca por proximidade (7.13b) — Event não tem lat/lng próprio, a
// localização é herdada de establishment_id → Establishment.profile.
describe("EventPrismaRepository — searchByProximity (7.13b)", () => {
  let repository: EventPrismaRepository;
  let prisma: PrismaClient;

  const now = new Date();
  const eventId = "b7f8e6a0-1c2d-4e3f-9a1b-2c3d4e5f6a7b";
  const establishmentId = "c8f9e7a1-2d3e-4f4a-8b2c-3d4e5f6a7b8c";
  const baseModel = {
    id: eventId,
    establishmentId,
    name: "Show",
    description: null,
    startTime: now,
    endTime: new Date(now.getTime() + 60 * 60 * 1000),
    status: "scheduled",
    maxCapacity: null,
    currentCapacity: 0,
    isPublic: true,
    coverCharge: null,
    created_at: now,
    updated_at: now,
  };

  beforeEach(() => {
    prisma = {
      event: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as any;
    repository = new EventPrismaRepository(prisma);
  });

  it("dispara searchByProximity quando lat/lng/radius_km estão presentes no filtro", async () => {
    (prisma.event.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: eventId,
          establishment: { profile: { location_lat: -23.561, location_lng: -46.656 } },
        },
      ])
      .mockResolvedValueOnce([baseModel]);

    const result = await repository.search(
      EventSearchParams.create({
        filter: { lat: -23.5614, lng: -46.6559, radius_km: 5 },
      }),
    );

    expect(prisma.event.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.event.count).not.toHaveBeenCalled();

    const [candidateCall] = (prisma.event.findMany as jest.Mock).mock.calls;
    const candidateWhere = candidateCall[0].where;
    expect(candidateWhere.establishment).toEqual({
      profile: {
        is: {
          location_lat: expect.objectContaining({ gte: expect.any(Number), lte: expect.any(Number) }),
          location_lng: expect.objectContaining({ gte: expect.any(Number), lte: expect.any(Number) }),
        },
      },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].event_id.id).toBe(eventId);
    expect(result.total).toBe(1);
  });

  it("exclui candidatos fora do raio exato (corte por Haversine)", async () => {
    (prisma.event.findMany as jest.Mock)
      .mockResolvedValueOnce([
        // Dentro da bounding box, mas fora do raio circular exato
        {
          id: "far-event",
          establishment: { profile: { location_lat: -23.9, location_lng: -46.9 } },
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await repository.search(
      EventSearchParams.create({
        filter: { lat: -23.5614, lng: -46.6559, radius_km: 5 },
      }),
    );

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    // Segunda chamada (refetch da página) não deveria acontecer sem ids
    expect(prisma.event.findMany).toHaveBeenCalledTimes(1);
  });

  it("usa o path padrão (sem proximidade) quando o trio geo está incompleto", async () => {
    (prisma.event.findMany as jest.Mock).mockResolvedValue([baseModel]);
    (prisma.event.count as jest.Mock).mockResolvedValue(1);

    const result = await repository.search(
      EventSearchParams.create({
        filter: { establishment_id: establishmentId },
      }),
    );

    expect(prisma.event.count).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
  });
});
