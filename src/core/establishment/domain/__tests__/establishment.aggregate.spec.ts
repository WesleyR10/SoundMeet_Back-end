import { Email } from "../../../shared/domain/value-objects/email.vo";
import { Phone } from "../../../shared/domain/value-objects/phone.vo";
import { Rating } from "../../../shared/domain/value-objects/rating.vo";
import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";
import { Establishment, EstablishmentId } from "../establishment.aggregate";
import { EstablishmentEmailChangedEvent } from "../events/establishment-email-changed.event";

describe("Establishment Unit Tests without validator", () => {
  beforeEach(() => {
    // Mock removido para permitir que o validate() real seja chamado pelo fake builder
  });

  test("constructor of establishment", () => {
    let establishment = Establishment.fake().anEstablishment().build();

    expect(establishment.establishment_id).toBeInstanceOf(EstablishmentId);
    expect(establishment.name).toBeTruthy(); // Nome não vazio
    expect(establishment.email).toBeInstanceOf(Email);
    expect(establishment.email.value).toContain("@"); // Email válido
    expect(establishment.phone).toBeDefined(); // Pode ser Phone ou null
    if (establishment.phone) {
      expect(establishment.phone).toBeInstanceOf(Phone);
      expect(establishment.phone.value).toMatch(/^\+?[0-9]{10,15}$/); // Formato telefone
    }
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

    expect(establishment.establishment_id).toBeInstanceOf(EstablishmentId);
    expect(establishment.name).toBe("Jazz Club");
    expect(establishment.description).toBe("Premium jazz venue");
    expect(establishment.avatar).toBe("https://example.com/avatar.jpg");
    expect(establishment.cnpj?.formatted).toBe("88.226.299/0001-48");
    expect(establishment.email.value).toBe("info@jazzclub.com");
    expect(establishment.phone!.value).toBe("+5511888888888");
    expect(establishment.website).toBe("https://jazzclub.com");
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
      .withEstablishmentType("pub")
      .build();

    expect(establishment.establishment_id).toBeInstanceOf(EstablishmentId);
    expect(establishment.name).toBe("Music Pub");
    expect(establishment.email.value).toBe("contact@musicpub.com");
    expect(establishment.phone!.value).toBe("+5511777777777");
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

  test("🔴 pedir troca de e-mail NÃO troca o e-mail — só emite o pedido", () => {
    const establishment = Establishment.fake().anEstablishment().build();
    const current = establishment.email.value;

    establishment.requestEmailChange("new@test.com");

    expect(establishment.email.value).toBe(current);
    expect(establishment.notification.hasErrors()).toBe(false);
    const requested = establishment
      .getUncommittedEvents()
      .find((e) => e instanceof EstablishmentEmailChangedEvent) as
      | EstablishmentEmailChangedEvent
      | undefined;
    expect(requested?.new_email).toBe("new@test.com");
  });

  test("pedido com e-mail inválido vira erro de validação e não emite evento", () => {
    const establishment = Establishment.fake().anEstablishment().build();

    establishment.requestEmailChange("invalid-email");

    expect(establishment.notification.hasErrors()).toBe(true);
    expect(
      establishment
        .getUncommittedEvents()
        .some((e) => e instanceof EstablishmentEmailChangedEvent),
    ).toBe(false);
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
      establishment_id: establishment.establishment_id.id,
      name: establishment.name,
      description: establishment.description,
      avatar: establishment.avatar,
      cnpj: establishment.cnpj?.toJSON() ?? null,
      email: establishment.email.value,
      phone: establishment.phone?.value || null,
      website: establishment.website,
      establishment_type: establishment.establishment_type,
      rating: establishment.rating.value,
      total_ratings: establishment.total_ratings,
      qr_code: establishment.qr_code?.code || null,
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

describe("Establishment — foto de perfil (avatar + avatar_key)", () => {
  test("changeAvatar grava URL e chave e devolve a chave ANTERIOR para faxina", () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withAvatarImage(
        "https://cdn/old.webp",
        "establishments/x/avatar/old.webp",
      )
      .build();

    const previous = establishment.changeAvatar(
      "https://cdn/new.webp",
      "establishments/x/avatar/new.webp",
    );

    expect(previous).toBe("establishments/x/avatar/old.webp");
    expect(establishment.avatar).toBe("https://cdn/new.webp");
    expect(establishment.avatar_key).toBe("establishments/x/avatar/new.webp");
  });

  test("changeAvatar com a MESMA chave não devolve nada — apagá-la deixaria o registro apontando para objeto inexistente", () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withAvatarImage("https://cdn/a.webp", "establishments/x/avatar/a.webp")
      .build();

    expect(
      establishment.changeAvatar(
        "https://cdn/a.webp",
        "establishments/x/avatar/a.webp",
      ),
    ).toBeNull();
  });

  test("avatar legado (URL sem chave) não produz chave para apagar", () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withAvatar("https://example.com/logo.png")
      .build();

    expect(
      establishment.changeAvatar(
        "https://cdn/n.webp",
        "establishments/x/avatar/n.webp",
      ),
    ).toBeNull();
    expect(establishment.removeAvatar()).toBe("establishments/x/avatar/n.webp");
    expect(establishment.avatar).toBeNull();
    expect(establishment.avatar_key).toBeNull();
  });

  test("toJSON carrega a chave — o presenter é quem a deixa de fora", () => {
    const establishment = Establishment.fake()
      .anEstablishment()
      .withAvatarImage("https://cdn/a.webp", "establishments/x/avatar/a.webp")
      .build();

    expect(establishment.toJSON()).toMatchObject({
      avatar: "https://cdn/a.webp",
      avatar_key: "establishments/x/avatar/a.webp",
    });
  });
});
