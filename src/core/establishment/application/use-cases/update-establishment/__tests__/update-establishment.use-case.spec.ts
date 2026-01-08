import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { InvalidEmailError } from "../../../../../shared/domain/value-objects/email.vo";
import {
  Establishment,
  EstablishmentId,
} from "../../../../domain/establishment.aggregate";
import { EstablishmentFakeBuilder } from "../../../../domain/establishment-fake.builder";
import { EstablishmentInMemoryRepository } from "../../../../infra/db/in-memory/establishment-in-memory.repository";
import { UpdateEstablishmentUseCase } from "../update-establishment.use-case";

describe("UpdateEstablishmentUseCase Unit Tests", () => {
  let useCase: UpdateEstablishmentUseCase;
  let repository: EstablishmentInMemoryRepository;

  beforeEach(() => {
    repository = new EstablishmentInMemoryRepository();
    useCase = new UpdateEstablishmentUseCase(repository);
  });

  it("should throw an error when establishment not found", async () => {
    const establishmentId = new EstablishmentId();
    const input = {
      id: establishmentId.id,
      name: "Updated Bar",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(establishmentId.id, Establishment),
    );
  });

  it("should throw an error when aggregate is not valid", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    repository.items = [establishment];

    const input = {
      id: establishment.establishment_id.id,
      name: "t".repeat(256),
      email: "invalid-email",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidEmailError,
    );
  });

  describe("should update an establishment", () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment()
      .withName("Original Bar")
      .withEmail("original@bar.com")
      .withCnpj("84.244.955/0001-84")
      .build();

    beforeEach(() => {
      repository.items = [establishment];
    });

    const arrange = [
      {
        input: {
          id: establishment.establishment_id.id,
          name: "Updated Bar",
        },
        expected: {
          name: "Updated Bar",
          email: "original@bar.com",
          cnpj: "12.345.678/0001-95",
        },
      },
      {
        input: {
          id: establishment.establishment_id.id,
          name: "Rock Club Updated",
          email: "updated@rockclub.com",
          description: "Updated description",
          avatar: "https://example.com/new-avatar.jpg",
          phone: "+5511888888888",
          address_street: "456 New Rock Street",
          address_number: "123",
          address_neighborhood: "Pinheiros",
          address_city: "São Paulo",
          address_state: "SP",
          address_zipcode: "01234-567",
          website: "https://newrockclub.com",
          is_active: false,
        },
        expected: {
          name: "Rock Club Updated",
          email: "updated@rockclub.com",
          description: "Updated description",
          avatar: "https://example.com/new-avatar.jpg",
          phone: "+5511888888888",
          address_street: "456 New Rock Street",
          address_number: "123",
          address_neighborhood: "Pinheiros",
          address_city: "São Paulo",
          address_state: "SP",
          address_zipcode: "01234-567",
          website: "https://newrockclub.com",
          is_active: false,
        },
      },
    ];

    test.each(arrange)("when input is $input", async ({ input, expected }) => {
      const output = await useCase.execute(input);
      expect(output).toStrictEqual({
        id: establishment.establishment_id.id,
        name: expected.name,
        email: expected.email,
        cnpj: establishment.cnpj
          ? {
              formatted: establishment.cnpj.formatted,
              value: establishment.cnpj.value,
            }
          : null,
        description: expected.description || establishment.description,
        avatar: expected.avatar || establishment.avatar,
        phone: expected.phone || establishment.phone?.value || null,
        address_street:
          expected.address_street || establishment.address?.street || null,
        address_number:
          expected.address_number || establishment.address?.number || null,
        address_neighborhood:
          expected.address_neighborhood ||
          establishment.address?.neighborhood ||
          null,
        address_city:
          expected.address_city || establishment.address?.city || null,
        address_state:
          expected.address_state || establishment.address?.state || null,
        address_zipcode:
          expected.address_zipcode || establishment.address?.zipCode || null,
        website: expected.website || establishment.website,
        establishment_type: establishment.establishment_type,
        qr_code: expect.any(String),
        rating: establishment.rating.value,
        total_ratings: establishment.total_ratings,
        is_active:
          expected.is_active !== undefined
            ? expected.is_active
            : establishment.is_active,
        is_verified: establishment.is_verified,
        created_at: establishment.created_at,
        is_bar: establishment.establishment_type === "bar",
        is_club: establishment.establishment_type === "club",
        is_highly_rated: false,
        is_popular: false,
        is_restaurant: establishment.establishment_type === "restaurant",
      });
    });
  });

  it("should update establishment with QR code generation", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    repository.items = [establishment];

    const input = {
      id: establishment.establishment_id.id,
      name: "QR Updated Bar",
      generate_qr_code: true,
    };

    const output = await useCase.execute(input);

    expect(output.qr_code).not.toBeNull();
    expect(output.qr_code).toMatch(
      /^soundmeet:\/\/establishment\/[a-f0-9-]{36}$/,
    );
  });

  it("should save the updated establishment in the repository", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    repository.items = [establishment];

    const input = {
      id: establishment.establishment_id.id,
      name: "Repository Updated Bar",
      email: "repo@updated.com",
    };

    const output = await useCase.execute(input);
    const savedEstablishment = await repository.findById(
      new EstablishmentId(output.id),
    );

    expect(savedEstablishment).toBeDefined();
    expect(savedEstablishment!.name).toBe(input.name);
    expect(savedEstablishment!.email.value).toBe(input.email);
  });

  it("should handle validation errors properly", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment().build();
    repository.items = [establishment];

    const input = {
      id: establishment.establishment_id.id,
      name: "",
      email: "invalid-email",
    };

    await expect(useCase.execute(input)).rejects.toThrow(InvalidEmailError);
  });

  it("should not change CNPJ when updating", async () => {
    const establishment = EstablishmentFakeBuilder.anEstablishment()
      .withCnpj("84244955000184")
      .build();
    repository.items = [establishment];

    const input = {
      id: establishment.establishment_id.id,
      name: "Updated Name",
      cnpj: "90.441.272/0001-10", // This should be ignored
    };

    const output = await useCase.execute(input);

    expect(output.cnpj).toEqual({
      formatted: "84.244.955/0001-84",
      value: "84244955000184",
    }); // Original CNPJ preserved
  });
});
