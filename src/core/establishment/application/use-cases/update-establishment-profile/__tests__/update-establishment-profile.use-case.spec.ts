import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import {
  Establishment,
  EstablishmentId,
} from "../../../../domain/establishment.aggregate";
import { EstablishmentFakeBuilder } from "../../../../domain/establishment-fake.builder";
import { EstablishmentInMemoryRepository } from "../../../../infra/db/in-memory/establishment-in-memory.repository";
import { UpdateEstablishmentProfileUseCase } from "../update-establishment-profile.use-case";

describe("UpdateEstablishmentProfileUseCase Unit Tests", () => {
  let useCase: UpdateEstablishmentProfileUseCase;
  let repository: EstablishmentInMemoryRepository;

  beforeEach(() => {
    repository = new EstablishmentInMemoryRepository();
    useCase = new UpdateEstablishmentProfileUseCase(repository);
  });

  it("should throw an error when establishment not found", async () => {
    const establishmentId = new EstablishmentId();
    await expect(() =>
      useCase.execute({
        id: establishmentId.id,
        location: {
          street: "Rua A",
          number: "10",
          neighborhood: "Centro",
          city: "São Paulo",
          state: "SP",
          zipCode: "01001000",
        },
      }),
    ).rejects.toThrow(new NotFoundError(establishmentId.id, Establishment));
  });

  it("should require location when profile does not exist", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    repository.items = [establishment];

    await expect(() =>
      useCase.execute({
        id: establishment.establishment_id.id,
        capacity: 100,
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("should create profile and update fields", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    repository.items = [establishment];

    const output = await useCase.execute({
      id: establishment.establishment_id.id,
      capacity: 200,
      location: {
        street: "Rua A",
        number: "10",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        zipCode: "01001000",
        latitude: -23.55,
        longitude: -46.63,
      },
      amenities: ["Wi-Fi"],
      preferredGenres: ["rock"],
      operatingHours: { mon: "10-18" },
      priceRange: {
        model: "per_event",
        min: 100,
        max: 200,
      },
      socialLinks: {
        links: [
          {
            platform: "instagram",
            username: "bar",
            url: "https://www.instagram.com/bar",
          },
        ],
      },
    });

    expect(output.establishment_id).toBe(establishment.establishment_id.id);
    expect(output.capacity).toBe(200);
    expect(output.amenities).toEqual(["Wi-Fi"]);
    expect(output.preferred_genres).toEqual(["rock"]);
    expect(output.operating_hours).toEqual({
      timezone: "UTC",
      weekly: {
        1: [{ start: "10:00", end: "18:00" }],
      },
      specialDays: [],
      vacations: [],
      closures: [],
    });
    expect(output.price_range).toMatchObject({
      model: "per_event",
      min: 100,
      max: 200,
    });
    expect(output.social_links).toEqual(
      expect.objectContaining({
        links: expect.any(Array),
      }),
    );
  });

  it("should save the updated profile in the repository", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    repository.items = [establishment];

    const output = await useCase.execute({
      id: establishment.establishment_id.id,
      location: {
        street: "Rua A",
        number: "10",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        zipCode: "01001000",
      },
    });

    const saved = await repository.findById(
      new EstablishmentId(establishment.establishment_id.id),
    );
    expect(saved).toBeTruthy();
    expect(saved!.profile).toBeTruthy();
    expect(saved!.profile!.location.city).toBe("São Paulo");
  });

  it("should throw EntityValidationError when operatingHours is invalid", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    repository.items = [establishment];

    await expect(() =>
      useCase.execute({
        id: establishment.establishment_id.id,
        location: {
          street: "Rua A",
          number: "10",
          neighborhood: "Centro",
          city: "São Paulo",
          state: "SP",
          zipCode: "01001000",
        },
        operatingHours: { timezone: "Invalid/Timezone" },
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("should throw EntityValidationError when socialLinks is invalid", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    repository.items = [establishment];

    await expect(() =>
      useCase.execute({
        id: establishment.establishment_id.id,
        location: {
          street: "Rua A",
          number: "10",
          neighborhood: "Centro",
          city: "São Paulo",
          state: "SP",
          zipCode: "01001000",
        },
        socialLinks: {
          links: [
            {
              platform: "instagram",
              username: "bar",
              url: "https://example.com/not-instagram",
            },
          ],
        },
      }),
    ).rejects.toThrow(EntityValidationError);
  });
});
