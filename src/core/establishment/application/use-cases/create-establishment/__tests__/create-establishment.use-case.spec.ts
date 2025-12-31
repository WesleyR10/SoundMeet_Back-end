import { InvalidEmailError } from "../../../../../shared/domain/value-objects/email.vo";
import { EstablishmentId } from "../../../../domain/establishment.aggregate";
import { EstablishmentInMemoryRepository } from "../../../../infra/db/in-memory/establishment-in-memory.repository";
import { CreateEstablishmentInput } from "../create-establishment.input";
import { CreateEstablishmentUseCase } from "../create-establishment.use-case";

describe("CreateEstablishmentUseCase Unit Tests", () => {
  let useCase: CreateEstablishmentUseCase;
  let repository: EstablishmentInMemoryRepository;

  beforeEach(() => {
    repository = new EstablishmentInMemoryRepository();
    useCase = new CreateEstablishmentUseCase(repository);
  });

  it("should throw an error when aggregate is not valid", async () => {
    const input: CreateEstablishmentInput = {
      name: "t".repeat(256),
      email: "invalid-email",
      cnpj: "12.345.678/0001-90",
      phone: "+5500000000000",
      address_street: "",
      address_number: "",
      address_city: "",
      address_state: "",
      address_zipcode: "",
      establishment_type: "bar",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidEmailError,
    );
  });

  describe("should create an establishment", () => {
    const arrange = [
      {
        input: {
          name: "Test Bar",
          email: "test@bar.com",
          phone: "+5511999999999",
          address_street: "Rua Test",
          address_number: "123",
          address_neighborhood: "Centro",
          address_city: "São Paulo",
          address_state: "SP",
          address_zipcode: "01234-567",
          establishment_type: "bar",
          cnpj: "11.222.333/0001-81",
        },
        expected: {
          name: "Test Bar",
          email: "test@bar.com",
          cnpj: {
            formatted: "11.222.333/0001-81",
            value: "11222333000181",
          },
          description: null,
          avatar: null,
          phone: "+5511999999999",
          address_street: "Rua Test",
          address_number: null,
          address_city: "São Paulo",
          address_state: null,
          address_zipcode: null,
          establishment_type: "bar",
          website: null,
          rating: 0,
          is_active: true,
          is_verified: false,
        },
      },
      {
        input: {
          name: "Rock Club",
          email: "contact@rockclub.com",
          cnpj: "12.345.678/0001-95",
          description: "The best rock club in town",
          avatar: "https://example.com/avatar.jpg",
          phone: "+5511999999999",
          address_street: "123 Rock Street",
          address_number: "456",
          address_neighborhood: "Vila Madalena",
          address_city: "São Paulo",
          address_state: "SP",
          address_zipcode: "01234-567",
          establishment_type: "club",
          website: "https://rockclub.com",
          is_active: false,
        },
        expected: {
          name: "Rock Club",
          email: "contact@rockclub.com",
          cnpj: {
            formatted: "12.345.678/0001-95",
            value: "12345678000195",
          },
          description: "The best rock club in town",
          avatar: "https://example.com/avatar.jpg",
          phone: "+5511999999999",
          address_street: "123 Rock Street",
          address_number: null,
          address_city: "São Paulo",
          address_state: null,
          address_zipcode: null,
          establishment_type: "club",
          website: "https://rockclub.com",
          rating: 0,
          is_active: false,
          is_verified: false,
        },
      },
    ];

    test.each(arrange)("when input is $input", async ({ input, expected }) => {
      const output = await useCase.execute(input);
      expect(output).toMatchObject({
        id: expect.any(String),
        name: expected.name,
        email: expected.email,
        cnpj: expected.cnpj,
        description: expected.description,
        avatar: expected.avatar,
        phone: expected.phone,
        address_street: expected.address_street,
        address_city: expected.address_city,
        establishment_type: expected.establishment_type,
        website: expected.website,
        rating: expected.rating,
        is_active: expected.is_active,
        is_verified: expected.is_verified,
        created_at: expect.any(Date),
      });
    });
  });

  it("should create an establishment successfully", async () => {
    const input: CreateEstablishmentInput = {
      name: "QR Bar",
      email: "qr@bar.com",
      phone: "+5511999999999",
      address_street: "Rua QR",
      address_number: "100",
      address_neighborhood: "Centro",
      address_city: "São Paulo",
      address_state: "SP",
      address_zipcode: "01234-567",
      establishment_type: "bar",
      cnpj: "11.111.111/0001-91",
    };

    const output = await useCase.execute(input);

    expect(output.id).toBeDefined();
    expect(output.name).toBe(input.name);
    expect(output.email).toBe(input.email);
  });

  it("should save the establishment in the repository", async () => {
    const input: CreateEstablishmentInput = {
      name: "Save Test Bar",
      email: "save@test.com",
      phone: "+5511888888888",
      address_street: "Rua Save",
      address_number: "789",
      address_neighborhood: "Liberdade",
      address_city: "São Paulo",
      address_state: "SP",
      address_zipcode: "01234-567",
      establishment_type: "restaurant",
      cnpj: "11.222.333/0001-81",
    };

    const output = await useCase.execute(input);
    const savedEstablishment = await repository.findById(
      new EstablishmentId(output.id),
    );

    expect(savedEstablishment).toBeDefined();
    expect(savedEstablishment!.name).toBe(input.name);
    expect(savedEstablishment!.email.value).toBe(input.email);
    expect(savedEstablishment!.cnpj?.value).toBe("11222333000181");
  });

  it("should handle validation errors properly", async () => {
    const input: CreateEstablishmentInput = {
      name: "",
      email: "invalid-email",
      cnpj: "",
      phone: "+5500000000000",
      address_street: "",
      address_number: "",
      address_city: "",
      address_state: "",
      address_zipcode: "",
      establishment_type: "bar",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidEmailError,
    );
  });
});
