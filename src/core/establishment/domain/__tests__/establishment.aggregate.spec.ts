import { Address } from "../../../shared/domain/value-objects/address.vo";
import { Email } from "../../../shared/domain/value-objects/email.vo";
import { Phone } from "../../../shared/domain/value-objects/phone.vo";
import { Rating } from "../../../shared/domain/value-objects/rating.vo";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { Establishment, EstablishmentId } from "../establishment.aggregate";

describe("Establishment Unit Tests without validator", () => {
  beforeEach(() => {
    // Mock removido para permitir que o validate() real seja chamado pelo fake builder
  });

  test("constructor of establishment", () => {
    let establishment = Establishment.fake().anEstablishment().build();

    expect(establishment.id).toBeInstanceOf(EstablishmentId);
    expect(establishment.name).toBeTruthy(); // Nome não vazio
    expect(establishment.email).toBeInstanceOf(Email);
    expect(establishment.email.value).toContain("@"); // Email válido
    expect(establishment.phone).toBeDefined(); // Pode ser Phone ou null
    if (establishment.phone) {
      expect(establishment.phone).toBeInstanceOf(Phone);
      expect(establishment.phone.value).toMatch(/^\+?[0-9]{10,15}$/); // Formato telefone
    }
    expect(establishment.address).toBeInstanceOf(Address);
    expect(establishment.address.street).toBeTruthy(); // Rua não vazia
    expect(establishment.address.number).toBeTruthy(); // Número não vazio
    expect(establishment.address.city).toBeTruthy(); // Cidade não vazia
    expect(establishment.address.state).toBeTruthy(); // Estado não vazio
    expect(establishment.address.zipCode).toBeTruthy(); // CEP não vazio
    expect(establishment.establishment_type).toBeTruthy(); // Tipo não vazio
    expect(establishment.description).toBeNull();
    expect(establishment.avatar).toBeNull();
    expect(establishment.cnpj).toBeDefined(); // Pode ser CNPJ válido ou null
    expect(establishment.website).toBeDefined(); // Pode ser website válido ou null
    expect(establishment.rating).toBeInstanceOf(Rating);
    expect(establishment.rating.value).toBe(0);
    expect(establishment.is_active).toBe(true);
    expect(establishment.is_verified).toBe(false);
    expect(establishment.created_at).toBeInstanceOf(Date);

    const created_at = new Date();
    establishment = Establishment.fake()
      .anEstablishment()
      .withName("Jazz Club")
      .withEmail("info@jazzclub.com")
      .withPhone("+5511888888888")
      .withAddress({
        street: "Jazz Avenue",
        number: "456",
        city: "Rio de Janeiro",
        state: "RJ",
        zipCode: "20000-000",
        neighborhood: "Copacabana",
      })
      .withEstablishmentType("club")
      .withDescription("Premium jazz venue")
      .withAvatar("https://example.com/avatar.jpg")
      .withCnpj("88226299000148")
      .withWebsite("https://jazzclub.com")
      .withRating(4.5)
      .withIsActive(false)
      .withIsVerified(true)
      .withcreated_at(created_at)
      .build();

    expect(establishment.id).toBeInstanceOf(EstablishmentId);
    expect(establishment.name).toBe("Jazz Club");
    expect(establishment.description).toBe("Premium jazz venue");
    expect(establishment.avatar).toBe("https://example.com/avatar.jpg");
    expect(establishment.cnpj?.formatted).toBe("88.226.299/0001-48");
    expect(establishment.email.value).toBe("info@jazzclub.com");
    expect(establishment.phone!.value).toBe("+5511888888888");
    expect(establishment.website).toBe("https://jazzclub.com");
    expect(establishment.address.street).toBe("Jazz Avenue");
    expect(establishment.address.number).toBe("456");
    expect(establishment.address.city).toBe("Rio de Janeiro");
    expect(establishment.address.state).toBe("RJ");
    expect(establishment.address.zipCode).toBe("20000-000");
    expect(establishment.establishment_type).toBe("club");
    expect(establishment.rating.value).toBe(4.5);
    expect(establishment.is_active).toBe(false);
    expect(establishment.is_verified).toBe(true);
    expect(establishment.created_at).toBe(created_at);
  });

  test("should create establishment with create command", () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withName("Music Pub")
      .withEmail("contact@musicpub.com")
      .withPhone("+5511777777777")
      .withAddress({
        street: "Music Street",
        number: "789",
        neighborhood: "Centro",
        city: "Belo Horizonte",
        state: "MG",
        zipCode: "30000-000",
      })
      .withEstablishmentType("pub")
      .build();

    expect(establishment.id).toBeInstanceOf(EstablishmentId);
    expect(establishment.name).toBe("Music Pub");
    expect(establishment.email.value).toBe("contact@musicpub.com");
    expect(establishment.phone!.value).toBe("+5511777777777");
    expect(establishment.address).toBeInstanceOf(Address);
    expect(establishment.address.street).toBe("Music Street");
    expect(establishment.address.number).toBe("789");
    expect(establishment.address.city).toBe("Belo Horizonte");
    expect(establishment.address.state).toBe("MG");
    expect(establishment.address.zipCode).toBe("30000-000");
    expect(establishment.establishment_type).toBe("pub");
    expect(establishment.is_active).toBe(true);
    expect(establishment.is_verified).toBe(false);
    // O validate() agora é chamado automaticamente pelo fake builder
    expect(establishment.notification.hasErrors()).toBe(false); // Verifica que não há erros de validação
  });

  test("should change name", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    establishment.changeName("New Name");
    expect(establishment.name).toBe("New Name");
    // O validate() é chamado internamente pelo método changeName
    expect(establishment.notification.hasErrors()).toBe(false); // Verifica que não há erros de validação
  });

  test("should change email", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    establishment.changeEmail("new@test.com");
    expect(establishment.email.value).toBe("new@test.com");
    // O validate() é chamado internamente pelo método changeEmail
    expect(establishment.notification.hasErrors()).toBe(false); // Verifica que não há erros de validação
  });

  test("should change phone", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    establishment.changePhone("+5511888888888");
    expect(establishment.phone!.value).toBe("+5511888888888");
    // O validate() é chamado internamente pelo método changePhone
    expect(establishment.notification.hasErrors()).toBe(false); // Verifica que não há erros de validação
  });

  test("should activate and deactivate", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    expect(establishment.is_active).toBe(true);
    establishment.deactivate();
    expect(establishment.is_active).toBe(false);
    establishment.activate();
    expect(establishment.is_active).toBe(true);
  });

  test("should verify and unverify", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    expect(establishment.is_verified).toBe(false);
    establishment.verify();
    expect(establishment.is_verified).toBe(true);
    establishment.unverify();
    expect(establishment.is_verified).toBe(false);
  });

  test("should return json", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    const json = establishment.toJSON();
    expect(json).toMatchObject({
      establishment_id: establishment.id.id,
      name: establishment.name,
      description: establishment.description,
      avatar: establishment.avatar,
      cnpj: establishment.cnpj,
      email: establishment.email.value,
      phone: establishment.phone?.value || null,
      website: establishment.website,
      address: {
        street: establishment.address.street,
        number: establishment.address.number,
        complement: establishment.address.complement,
        neighborhood: establishment.address.neighborhood,
        city: establishment.address.city,
        state: establishment.address.state,
        zipCode: establishment.address.zipCode,
        country: establishment.address.country,
        latitude: establishment.address.latitude,
        longitude: establishment.address.longitude,
        coordinates: establishment.address.coordinates,
        hasCoordinates: establishment.address.hasCoordinates,
        formattedZipCode: establishment.address.formattedZipCode,
        fullAddress: establishment.address.fullAddress,
        shortAddress: establishment.address.shortAddress,
      },
      establishment_type: establishment.establishment_type,
      rating: establishment.rating.value,
      total_ratings: establishment.total_ratings,
      is_active: establishment.is_active,
      is_verified: establishment.is_verified,
      created_at: establishment.created_at,
    });
  });

  test("should add rating", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    const userId = new Uuid();

    // Primeira avaliação
    establishment.addRating(5, userId, "Excelente estabelecimento!");
    expect(establishment.rating.value).toBe(5);
    expect(establishment.total_ratings).toBe(1);

    // Segunda avaliação (sem comentário)
    establishment.addRating(3, userId, null);
    expect(establishment.rating.value).toBe(4); // (5 + 3) / 2 = 4
    expect(establishment.total_ratings).toBe(2);

    // Terceira avaliação
    establishment.addRating(4, userId, "Bom ambiente");
    expect(establishment.rating.value).toBe(4); // (5 + 3 + 4) / 3 = 4
    expect(establishment.total_ratings).toBe(3);

    // Quarta avaliação (5 estrelas)
    establishment.addRating(5, userId, undefined);
    expect(establishment.rating.value).toBe(4.3); // (5 + 3 + 4 + 5) / 4 = 4.25, arredondado para 4.3
    expect(establishment.total_ratings).toBe(4);
  });
});
