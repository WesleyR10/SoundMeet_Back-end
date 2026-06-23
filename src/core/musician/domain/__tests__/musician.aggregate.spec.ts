import { Email } from "../../../shared/domain/value-objects/email.vo";
import { Phone } from "../../../shared/domain/value-objects/phone.vo";
import { QRCode } from "../../../shared/domain/value-objects/qr-code.vo";
import { Rating } from "../../../shared/domain/value-objects/rating.vo";
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
      qr_code: "QR123456",
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
    expect(musician.qr_code?.code).toBe("QR123456");
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
    musician.changeAvatar("https://example.com/new-avatar.jpg");
    expect(musician.avatar).toBe("https://example.com/new-avatar.jpg");

    musician.changeAvatar(null);
    expect(musician.avatar).toBeNull();
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

  test("should add rating", () => {
    const musician = new Musician({
      name: "John Doe",
      email: "john@example.com",
      genres: ["Rock"],
      instruments: ["Guitar"],
    });
    musician.addRating(4);
    expect(musician.rating.value).toBe(4);
    expect(musician.total_ratings).toBe(1);

    musician.addRating(5);
    expect(musician.rating.value).toBe(4.5);
    expect(musician.total_ratings).toBe(2);
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
      genres: ["Rock", "Pop"],
      instruments: ["Guitar", "Piano"],
      experience_years: 10,
      qr_code: "QR123456",
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
      phone: "+5511999999999",
      genres: ["Rock", "Pop"],
      instruments: ["Guitar", "Piano"],
      experience_years: 10,
      qr_code: "QR123456",
      rating: 4.5,
      total_ratings: 100,
      is_active: true,
      is_verified: true,
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
