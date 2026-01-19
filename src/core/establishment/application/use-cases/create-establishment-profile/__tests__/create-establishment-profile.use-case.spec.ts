import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import {
  Establishment,
  EstablishmentId,
} from "../../../../domain/establishment.aggregate";
import { EstablishmentFakeBuilder } from "../../../../domain/establishment-fake.builder";
import { EstablishmentInMemoryRepository } from "../../../../infra/db/in-memory/establishment-in-memory.repository";
import { CreateEstablishmentProfileUseCase } from "../create-establishment-profile.use-case";

describe("CreateEstablishmentProfileUseCase Unit Tests", () => {
  let useCase: CreateEstablishmentProfileUseCase;
  let repository: EstablishmentInMemoryRepository;

  beforeEach(() => {
    repository = new EstablishmentInMemoryRepository();
    useCase = new CreateEstablishmentProfileUseCase(repository);
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

  it("should throw an error when profile already exists", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    repository.items = [establishment];

    await useCase.execute({
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
      }),
    ).rejects.toThrow(EntityValidationError);
  });

  it("should create profile and save in repository", async () => {
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
      },
      amenities: ["Wi-Fi"],
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
    expect(output.social_links).toStrictEqual({
      links: [
        {
          platform: "instagram",
          username: "bar",
          url: "https://www.instagram.com/bar",
          isVerified: false,
          followersCount: 0,
        },
      ],
      platforms: ["instagram"],
      totalFollowers: 0,
      verifiedCount: 0,
      isEmpty: false,
      size: 1,
    });

    const saved = await repository.findById(
      new EstablishmentId(establishment.establishment_id.id),
    );
    expect(saved).toBeTruthy();
    expect(saved!.profile).toBeTruthy();
    expect(saved!.profile!.capacity).toBe(200);
    expect(saved!.profile!.socialLinks).toBeTruthy();
    expect(saved!.profile!.socialLinks!.links[0]).toStrictEqual({
      platform: "instagram",
      username: "bar",
      url: "https://www.instagram.com/bar",
    });
  });

  it("should throw EntityValidationError when socialLinks is invalid", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    establishment.removeProfile();
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

  it("should throw EntityValidationError when operatingHours is invalid", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    establishment.removeProfile();
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
        operatingHours: {
          timezone: "Invalid/Timezone",
          weekly: { 1: [{ start: "10:00", end: "18:00" }] },
        },
      }),
    ).rejects.toThrow(EntityValidationError);
  });
});
