import { Email } from "../../../shared/domain/value-objects/email.vo";
import { Phone } from "../../../shared/domain/value-objects/phone.vo";
import { QRCode } from "../../../shared/domain/value-objects/qr-code.vo";
import { Rating } from "../../../shared/domain/value-objects/rating.vo";
import { generateValidCnpj } from "../../../shared/infra/testing/cnpj.fixture";
import { Musician, MusicianId } from "../musician.aggregate";

describe("Musician Unit Tests without validator", () => {
  beforeEach(() => {
    Musician.prototype.validate = jest
      .fn()
      .mockImplementation(Musician.prototype.validate);
  });

  test("constructor of musician", () => {
    let musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    expect(musician.musician_id).toBeInstanceOf(MusicianId);
    expect(musician.name).toBe("John Doe");
    expect(musician.email).toBeInstanceOf(Email);
    expect(musician.email.value).toBe("john@example.com");
    expect(musician.stage_name).toBeNull();
    expect(musician.bio).toBeNull();
    expect(musician.avatar).toBeNull();
    expect(musician.phone).toBeNull();
    expect(musician.genres).toEqual(["Rock"]);
    expect(musician.instruments).toEqual(["Guitar"]);
    expect(musician.experience_years).toBe(0);
    expect(musician.qr_code).toBeNull();
    expect(musician.rating).toBeInstanceOf(Rating);
    expect(musician.rating.value).toBe(0);
    expect(musician.total_ratings).toBe(0);
    expect(musician.is_active).toBe(true);
    expect(musician.is_verified).toBe(false);
    expect(musician.created_at).toBeInstanceOf(Date);

    const created_at = new Date();
    musician = new Musician({
      name: "Jane Smith",
      email: "jane@example.com",
      stage_name: "Jane Rock",
      bio: "Professional musician",
      avatar: "https://example.com/avatar.jpg",
      phone: "+5511999999999",
      genres: ["Rock", "Pop"],
      instruments: ["Guitar", "Piano"],
      experience_years: 10,
      qr_code:
        "https://soundmeet.com.br/musico/9366b7dc-2d71-4799-b91c-c64adb205104",
      rating: 4.5,
      total_ratings: 100,
      is_active: false,
      is_verified: true,
      created_at,
    });
    expect(musician.musician_id).toBeInstanceOf(MusicianId);
    expect(musician.name).toBe("Jane Smith");
    expect(musician.email.value).toBe("jane@example.com");
    expect(musician.stage_name).toBe("Jane Rock");
    expect(musician.bio).toBe("Professional musician");
    expect(musician.avatar).toBe("https://example.com/avatar.jpg");
    expect(musician.phone).toBeInstanceOf(Phone);
    expect(musician.phone?.value).toBe("+5511999999999");
    expect(musician.genres).toEqual(["Rock", "Pop"]);
    expect(musician.instruments).toEqual(["Guitar", "Piano"]);
    expect(musician.experience_years).toBe(10);
    expect(musician.qr_code).toBeInstanceOf(QRCode);
    expect(musician.qr_code?.code).toBe(
      "https://soundmeet.com.br/musico/9366b7dc-2d71-4799-b91c-c64adb205104",
    );
    expect(musician.rating.value).toBe(4.5);
    expect(musician.total_ratings).toBe(100);
    expect(musician.is_active).toBe(false);
    expect(musician.is_verified).toBe(true);
    expect(musician.created_at).toBe(created_at);
  });

  test("should have an id", () => {
    const musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    expect(musician.musician_id).toBeDefined();
    expect(musician.musician_id).toBeInstanceOf(MusicianId);
  });

  test("should create musician with create method", () => {
    const musician = Musician.create({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    expect(musician.musician_id).toBeInstanceOf(MusicianId);
    expect(musician.name).toBe("John Doe");
    expect(musician.email.value).toBe("john@example.com");
    expect(musician.genres).toEqual(["Rock"]);
    expect(musician.instruments).toEqual(["Guitar"]);
    expect(musician.qr_code).toBeInstanceOf(QRCode);
    expect(Musician.prototype.validate).toHaveBeenCalledTimes(1);
    expect(Musician.prototype.validate).toHaveBeenCalledWith(["name", "email"]);
  });

  test("should change name", () => {
    const musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    musician.changeName("Jane Doe");
    expect(musician.name).toBe("Jane Doe");
    expect(Musician.prototype.validate).toHaveBeenCalledWith(["name"]);
  });

  test("should change stage name", () => {
    const musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    musician.changeStageName("John Rock");
    expect(musician.stage_name).toBe("John Rock");

    musician.changeStageName(null);
    expect(musician.stage_name).toBeNull();
  });

  test("should change bio", () => {
    const musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    musician.changeBio("New bio");
    expect(musician.bio).toBe("New bio");

    musician.changeBio(null);
    expect(musician.bio).toBeNull();
  });

  test("should change avatar", () => {
    const musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    musician.changeAvatar(
      "https://example.com/new-avatar.jpg",
      "musicians/x/avatar/a.jpg",
    );
    expect(musician.avatar).toBe("https://example.com/new-avatar.jpg");
    expect(musician.avatar_key).toBe("musicians/x/avatar/a.jpg");

    musician.removeAvatar();
    expect(musician.avatar).toBeNull();
    expect(musician.avatar_key).toBeNull();
  });

  /*
   * 🔴 A chave do objeto é o que permite apagar a foto ANTERIOR. Sem ela,
   * cada troca deixava um arquivo de até 5 MB no bucket sem nada apontando
   * para ele — o defeito que o comentário de `presentation_audio_key` no
   * schema registrava para `avatar`.
   */
  describe("chave do objeto da foto e do logo do QR", () => {
    const make = () =>
      new Musician({
        name: "John Doe",
        email: "john@example.com",
        genres: ["Rock"],
        instruments: ["Guitar"],
      });

    test("a primeira foto não tem anterior a apagar", () => {
      expect(make().changeAvatar("https://cdn/a.jpg", "k/a.jpg")).toBeNull();
    });

    test("trocar a foto devolve a chave da ANTERIOR", () => {
      const musician = make();
      musician.changeAvatar("https://cdn/a.jpg", "k/a.jpg");

      expect(musician.changeAvatar("https://cdn/b.jpg", "k/b.jpg")).toBe(
        "k/a.jpg",
      );
      expect(musician.avatar_key).toBe("k/b.jpg");
    });

    test("foto sem chave (Google, ou anterior à coluna) não gera exclusão", () => {
      const musician = new Musician({
        name: "John Doe",
        email: "john@example.com",
        genres: [],
        instruments: [],
        avatar: "https://lh3.googleusercontent.com/foto",
      });

      expect(musician.changeAvatar("https://cdn/b.jpg", "k/b.jpg")).toBeNull();
      expect(musician.removeAvatar()).toBe("k/b.jpg");
    });

    test("reenviar a MESMA chave não manda apagar o objeto em uso", () => {
      const musician = make();
      musician.changeAvatar("https://cdn/a.jpg", "k/a.jpg");

      expect(musician.changeAvatar("https://cdn/a.jpg", "k/a.jpg")).toBeNull();
    });

    test("trocar o logo do QR devolve a chave do anterior e preserva o resto", () => {
      const musician = make();
      musician.customizeQRCode({
        foreground_color: "#000000",
        label: "Meu QR",
      });

      expect(
        musician.changeQrLogo("https://cdn/l1.png", "qr/l1.png"),
      ).toBeNull();
      expect(musician.changeQrLogo("https://cdn/l2.png", "qr/l2.png")).toBe(
        "qr/l1.png",
      );
      expect(musician.qr_logo_key).toBe("qr/l2.png");
      expect(musician.qr_code!.customization).toEqual({
        foreground_color: "#000000",
        label: "Meu QR",
        logo_url: "https://cdn/l2.png",
      });
    });

    test("remover o logo (logo_url: null) devolve a chave e a solta", () => {
      const musician = make();
      musician.changeQrLogo("https://cdn/l1.png", "qr/l1.png");

      expect(musician.customizeQRCode({ logo_url: null })).toBe("qr/l1.png");
      expect(musician.qr_logo_key).toBeNull();
      expect(musician.qr_code!.customization?.logo_url).toBeUndefined();
    });

    test("mexer só na cor ou na legenda NÃO toca no logo nem na chave", () => {
      const musician = make();
      musician.changeQrLogo("https://cdn/l1.png", "qr/l1.png");

      expect(musician.customizeQRCode({ label: "Outra" })).toBeNull();
      expect(musician.qr_logo_key).toBe("qr/l1.png");
      expect(musician.qr_code!.customization?.logo_url).toBe(
        "https://cdn/l1.png",
      );
    });

    test("as chaves não saem no toJSON", () => {
      const musician = make();
      musician.changeAvatar("https://cdn/a.jpg", "segredo/a.jpg");
      musician.changeQrLogo("https://cdn/l.png", "segredo/l.png");

      expect(JSON.stringify(musician.toJSON())).not.toContain("segredo/");
    });
  });

  test("should change phone", () => {
    const musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    musician.changePhone("+5511999999999");
    expect(musician.phone).toBeInstanceOf(Phone);
    expect(musician.phone?.value).toBe("+5511999999999");

    musician.changePhone(null);
    expect(musician.phone).toBeNull();
  });

  test("should update genres", () => {
    const musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    musician.updateGenres(["Rock", "Pop", "Jazz"]);
    expect(musician.genres).toEqual(["Rock", "Pop", "Jazz"]);
    expect(Musician.prototype.validate).toHaveBeenCalledWith(["genres"]);
  });

  test("should update instruments", () => {
    const musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    musician.updateInstruments(["Guitar", "Piano", "Drums"]);
    expect(musician.instruments).toEqual(["Guitar", "Piano", "Drums"]);
  });

  test("should update experience years", () => {
    const musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    musician.updateExperience(5);
    expect(musician.experience_years).toBe(5);
  });

  test("should generate QR code", () => {
    const musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    musician.generateQRCode();
    expect(musician.qr_code).toBeInstanceOf(QRCode);
    expect(musician.qr_code?.url).toContain(musician.musician_id.id);
  });

  /*
   * 🔴 `updated_at` só anda se o agregado o mover (o mapper grava o valor
   * explícito, então o `@updatedAt` do Prisma não atua). Trocar nome, bio ou
   * foto não o movia, e o sitemap publicava `lastModified` velho.
   */
  describe("updated_at acompanha as mudanças do perfil", () => {
    const makeOld = () =>
      new Musician({
        name: "John Doe",
        email: "john@example.com",
        genres: ["Rock"],
        instruments: ["Guitar"],
        updated_at: new Date("2020-01-01T00:00:00.000Z"),
      });

    test.each([
      ["changeName", (m: Musician) => m.changeName("Novo Nome")],
      ["changeStageName", (m: Musician) => m.changeStageName("Palco")],
      ["changeBio", (m: Musician) => m.changeBio("Nova bio")],
      [
        "changeAvatar",
        (m: Musician) => m.changeAvatar("https://cdn/x.jpg", "k/x.jpg"),
      ],
      ["removeAvatar", (m: Musician) => m.removeAvatar()],
      [
        "changeQrLogo",
        (m: Musician) => m.changeQrLogo("https://cdn/l.png", "k/l.png"),
      ],
      ["changePhone", (m: Musician) => m.changePhone("11999990000")],
      ["changeCnpj", (m: Musician) => m.changeCnpj(null)],
      ["updateGenres", (m: Musician) => m.updateGenres(["MPB"])],
      ["updateInstruments", (m: Musician) => m.updateInstruments(["Voz"])],
      ["updateExperience", (m: Musician) => m.updateExperience(7)],
      ["customizeQRCode", (m: Musician) => m.customizeQRCode({ label: "x" })],
      ["activate", (m: Musician) => m.activate()],
      ["deactivate", (m: Musician) => m.deactivate()],
      ["verify", (m: Musician) => m.verify()],
      ["unverify", (m: Musician) => m.unverify()],
      ["setOpenToGigs", (m: Musician) => m.setOpenToGigs(true)],
    ])("%s move updated_at", (_name, mutate) => {
      const musician = makeOld();

      mutate(musician);

      expect(musician.updated_at.getFullYear()).toBeGreaterThan(2020);
    });

    test.each([
      [
        "registerPushToken",
        (m: Musician) => m.registerPushToken("ExponentPushToken[x]", "ios"),
      ],
      ["clearPushToken", (m: Musician) => m.clearPushToken()],
      [
        "syncRatingProjection",
        (m: Musician) => m.syncRatingProjection(4.5, 10),
      ],
    ])("%s NÃO move: não é mudança do perfil", (_name, mutate) => {
      const musician = makeOld();

      mutate(musician);

      expect(musician.updated_at.toISOString()).toBe(
        "2020-01-01T00:00:00.000Z",
      );
    });

    test("experiência negativa é recusada e não conta como mudança", () => {
      const musician = makeOld();

      musician.updateExperience(-1);

      expect(musician.updated_at.toISOString()).toBe(
        "2020-01-01T00:00:00.000Z",
      );
      expect(musician.notification.hasErrors()).toBe(true);
    });
  });

  test("não existe addRating: a nota vem do ledger, via syncRatingProjection", () => {
    const musician = Musician.fake().aMusician().build();

    expect(
      (musician as unknown as Record<string, unknown>).addRating,
    ).toBeUndefined();

    musician.syncRatingProjection(4.26, 12);
    expect(musician.rating.value).toBe(4.3);
    expect(musician.total_ratings).toBe(12);
  });

  test("should activate and deactivate", () => {
    const musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
      is_active: false,
    });
    expect(musician.is_active).toBe(false);

    musician.activate();
    expect(musician.is_active).toBe(true);

    musician.deactivate();
    expect(musician.is_active).toBe(false);
  });

  test("should verify and unverify", () => {
    const musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    expect(musician.is_verified).toBe(false);

    musician.verify();
    expect(musician.is_verified).toBe(true);

    musician.unverify();
    expect(musician.is_verified).toBe(false);
  });

  test("should set open_to_gigs, never defaulting to true", () => {
    const musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    expect(musician.open_to_gigs).toBeNull();

    musician.setOpenToGigs(true);
    expect(musician.open_to_gigs).toBe(true);

    musician.setOpenToGigs(false);
    expect(musician.open_to_gigs).toBe(false);
  });

  test("should get display name", () => {
    let musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    expect(musician.displayName).toBe("John Doe");

    musician = new Musician({
      name: "John Doe",
      stage_name: "John Rock",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    expect(musician.displayName).toBe("John Rock");
  });

  test("should check if is experienced", () => {
    let musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
      experience_years: 2,
    });
    expect(musician.isExperienced).toBe(false);

    musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
      experience_years: 5,
    });
    expect(musician.isExperienced).toBe(true);
  });

  test("should check if is highly rated", () => {
    let musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
      rating: 3.5,
      total_ratings: 5,
    });
    expect(musician.isHighlyRated).toBe(false);

    musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
      rating: 4.5,
      total_ratings: 15,
    });
    expect(musician.isHighlyRated).toBe(true);
  });

  test("should convert to JSON", () => {
    const musician = new Musician({
      name: "John Doe",
      stage_name: "John Rock",
      email: "john@example.com",
      bio: "Professional musician",
      avatar: "https://example.com/avatar.jpg",
      phone: "+5511999999999",
      cpf: "52998224725",
      genres: ["Rock", "Pop"],
      instruments: ["Guitar", "Piano"],
      experience_years: 10,
      qr_code:
        "https://soundmeet.com.br/musico/9366b7dc-2d71-4799-b91c-c64adb205104",
      rating: 4.5,
      total_ratings: 100,
      is_active: true,
      is_verified: true,
    });

    const json = musician.toJSON();
    expect(json).toEqual({
      musician_id: musician.musician_id.id,
      email: "john@example.com",
      name: "John Doe",
      stage_name: "John Rock",
      bio: "Professional musician",
      avatar: "https://example.com/avatar.jpg",
      presentation_audio: null,
      phone: "+5511999999999",
      cpf: "52998224725",
      cnpj: null,
      genres: ["Rock", "Pop"],
      instruments: ["Guitar", "Piano"],
      experience_years: 10,
      qr_code:
        "https://soundmeet.com.br/musico/9366b7dc-2d71-4799-b91c-c64adb205104",
      qr_customization: null,
      rating: 4.5,
      total_ratings: 100,
      is_active: true,
      is_verified: true,
      open_to_gigs: null,
      accepts_requests_outside_repertoire: true,
      profile: null,
      created_at: musician.created_at,
      updated_at: musician.updated_at,
      display_name: "John Rock",
      is_experienced: true,
      is_highly_rated: true,
    });
  });
});

describe("Musician Unit Tests with validator", () => {
  describe("create command", () => {
    test("should have validation errors when name is invalid", () => {
      const musician = Musician.create({
        name: "t".repeat(256),
        email: "john@example.com",
        phone: "+5511999999999",
        genres: ["Rock"],
        instruments: ["Guitar"],
      });

      expect(musician.notification.hasErrors()).toBe(true);
    });

    test("should have validation errors when email is invalid", () => {
      const musician = Musician.create({
        name: "John Doe",
        email: "invalid-email",
        phone: "+5511999999999",
        genres: ["Rock"],
        instruments: ["Guitar"],
      });

      expect(musician.notification.hasErrors()).toBe(true);
    });

    test("should create a valid musician", () => {
      expect(() =>
        Musician.create({
          name: "John Doe",
          email: "john@example.com",
          phone: "+5511999999999",
          genres: ["Rock"],
          instruments: ["Guitar"],
        }),
      ).not.toThrow();
    });
  });

  describe("changeName method", () => {
    test("should have validation errors when name is invalid", () => {
      const musician = Musician.fake().aMusician().build();
      musician.changeName("t".repeat(256));
      expect(musician.notification.hasErrors()).toBe(true);
    });

    test("should change name when valid", () => {
      const musician = Musician.fake().aMusician().build();
      expect(() => musician.changeName("New Name")).not.toThrow();
      expect(musician.name).toBe("New Name");
    });
  });

  describe("changeStageName method", () => {
    test("should change stage name when valid", () => {
      const musician = Musician.fake().aMusician().build();
      expect(() => musician.changeStageName("New Stage Name")).not.toThrow();
      expect(musician.stage_name).toBe("New Stage Name");
    });
  });

  describe("changeBio method", () => {
    test("should change bio when valid", () => {
      const musician = Musician.fake().aMusician().build();
      expect(() => musician.changeBio("New bio")).not.toThrow();
      expect(musician.bio).toBe("New bio");
    });
  });

  describe("changePhone method", () => {
    test("should change phone when valid", () => {
      const musician = Musician.fake().aMusician().build();
      expect(() => musician.changePhone("+5511888888888")).not.toThrow();
      expect(musician.phone!.value).toBe("+5511888888888");
    });
  });

  describe("changeCnpj method (MEI)", () => {
    test("should set a valid cnpj", () => {
      const musician = Musician.fake().aMusician().build();
      const cnpj = generateValidCnpj("112223330001");

      musician.changeCnpj(cnpj);

      expect(musician.cnpj!.value).toBe(cnpj);
      expect(musician.notification.hasErrors()).toBe(false);
    });

    test("should accept a masked cnpj and store only digits", () => {
      const musician = Musician.fake().aMusician().build();

      musician.changeCnpj("11.222.333/0001-81");

      expect(musician.cnpj!.value).toBe("11222333000181");
    });

    // Baixar o MEI é um evento real: quem o faz volta a contratar como pessoa
    // física, e o contrato precisa acompanhar.
    test("should clear the cnpj when null is passed", () => {
      const musician = Musician.fake()
        .aMusician()
        .withCnpj(generateValidCnpj("112223330001"))
        .build();

      musician.changeCnpj(null);

      expect(musician.cnpj).toBeNull();
      expect(musician.notification.hasErrors()).toBe(false);
    });

    test("should notify and keep null when the check digits do not match", () => {
      const musician = Musician.fake().aMusician().build();

      musician.changeCnpj("11222333000199");

      expect(musician.cnpj).toBeNull();
      expect(musician.notification.hasErrors()).toBe(true);
      expect(musician.notification.toJSON()).toContainEqual(
        expect.objectContaining({ cnpj: expect.anything() }),
      );
    });

    test("should not throw for a musician without cnpj — the field is optional", () => {
      const musician = Musician.fake().aMusician().build();

      expect(musician.cnpj).toBeNull();
      expect(musician.toJSON().cnpj).toBeNull();
    });
  });

  describe("updateGenres method", () => {
    test("should update genres when valid", () => {
      const musician = Musician.fake().aMusician().build();
      const newGenres = ["Jazz", "Blues"];
      expect(() => musician.updateGenres(newGenres)).not.toThrow();
      expect(musician.genres).toEqual(newGenres);
    });
  });

  describe("updateInstruments method", () => {
    test("should update instruments when valid", () => {
      const musician = Musician.fake().aMusician().build();
      const newInstruments = ["Piano", "Violin"];
      expect(() => musician.updateInstruments(newInstruments)).not.toThrow();
      expect(musician.instruments).toEqual(newInstruments);
    });
  });

  describe("updateExperience method", () => {
    test("should update experience when valid", () => {
      const musician = Musician.fake().aMusician().build();
      expect(() => musician.updateExperience(15)).not.toThrow();
      expect(musician.experience_years).toBe(15);
    });
  });
});
