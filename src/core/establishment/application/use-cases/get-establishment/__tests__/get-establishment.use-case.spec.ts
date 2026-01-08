import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import {
  Establishment,
  EstablishmentId,
} from "../../../../domain/establishment.aggregate";
import { EstablishmentFakeBuilder } from "../../../../domain/establishment-fake.builder";
import { EstablishmentInMemoryRepository } from "../../../../infra/db/in-memory/establishment-in-memory.repository";
import { GetEstablishmentUseCase } from "../get-establishment.use-case";

describe("GetEstablishmentUseCase Unit Tests", () => {
  let useCase: GetEstablishmentUseCase;
  let repository: EstablishmentInMemoryRepository;

  beforeEach(() => {
    repository = new EstablishmentInMemoryRepository();
    useCase = new GetEstablishmentUseCase(repository);
  });

  it("should throw an error when establishment not found", async () => {
    const establishmentId = new EstablishmentId();
    const input = {
      id: establishmentId.id,
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(establishmentId.id, Establishment),
    );
  });

  it("should get an establishment", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment()
      .withName("Test Bar")
      .withEmail("test@bar.com")
      .withCnpj("11222333000181")
      .withDescription("A great bar")
      .withAvatar("https://example.com/avatar.jpg")
      .withPhone("+5511999999999")
      .build();

    repository.items = [establishment];

    const input = {
      id: establishment.establishment_id.id,
    };

    const output = await useCase.execute(input);

    expect(output).toMatchObject({
      id: establishment.establishment_id.id,
      name: "Test Bar",
      email: "test@bar.com",
      cnpj: {
        formatted: "11.222.333/0001-81",
        value: "11222333000181",
      },
      description: "A great bar",
      avatar: "https://example.com/avatar.jpg",
      phone: "+5511999999999",
      establishment_type: expect.any(String),
      rating: expect.any(Number),
      is_active: establishment.is_active,
      is_verified: establishment.is_verified,
      created_at: establishment.created_at,
    });
  });

  it("should get an establishment with all optional fields", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment()
      .withName("Complete Bar")
      .withEmail("complete@bar.com")
      .withCnpj("12345678000195")
      .withDescription("The most complete bar")
      .withAvatar("https://example.com/complete-avatar.jpg")
      .withPhone("+5511888888888")
      .build();

    // Manually set additional fields
    establishment.verify();

    repository.items = [establishment];

    const input = {
      id: establishment.establishment_id.id,
    };

    const output = await useCase.execute(input);

    expect(output).toMatchObject({
      id: establishment.establishment_id.id,
      name: "Complete Bar",
      email: "complete@bar.com",
      cnpj: {
        formatted: "12.345.678/0001-95",
        value: "12345678000195",
      },
      description: "The most complete bar",
      avatar: "https://example.com/complete-avatar.jpg",
      phone: "+5511888888888",
      establishment_type: expect.any(String),
      rating: expect.any(Number),
      is_active: establishment.is_active,
      is_verified: true,
      created_at: establishment.created_at,
    });
  });

  it("should get an inactive establishment", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment()
      .withName("Inactive Bar")
      .withEmail("inactive@bar.com")
      .withCnpj("88.226.299/0001-48")
      .deactivate()
      .build();

    repository.items = [establishment];

    const input = {
      id: establishment.establishment_id.id,
    };

    const output = await useCase.execute(input);

    expect(output.is_active).toBe(false);
    expect(output.name).toBe("Inactive Bar");
  });

  it("should get establishment with minimal data", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment()
      .withName("Minimal Bar")
      .withEmail("minimal@bar.com")
      .withCnpj("84.244.955/0001-84")
      .build();

    repository.items = [establishment];

    const input = {
      id: establishment.establishment_id.id,
    };

    const output = await useCase.execute(input);

    expect(output).toMatchObject({
      id: establishment.establishment_id.id,
      name: "Minimal Bar",
      email: "minimal@bar.com",
      cnpj: {
        formatted: "84.244.955/0001-84",
        value: "84244955000184",
      },
      description: null,
      avatar: null,
      phone: null,
      establishment_type: expect.any(String),
      website: expect.any(String),
      rating: expect.any(Number),
      is_active: true,
      is_verified: false,
      created_at: establishment.created_at,
    });
  });

  it("should handle different establishment IDs correctly", async () => {
    const establishment1 = EstablishmentFakeBuilder.anEstablishment()
      .withName("Bar 1")
      .build();
    const establishment2 = EstablishmentFakeBuilder.anEstablishment()
      .withName("Bar 2")
      .build();

    repository.items = [establishment1, establishment2];

    // Get first establishment
    const output1 = await useCase.execute({
      id: establishment1.establishment_id.id,
    });
    expect(output1.name).toBe("Bar 1");
    expect(output1.id).toBe(establishment1.establishment_id.id);

    // Get second establishment
    const output2 = await useCase.execute({
      id: establishment2.establishment_id.id,
    });
    expect(output2.name).toBe("Bar 2");
    expect(output2.id).toBe(establishment2.establishment_id.id);
  });
});
