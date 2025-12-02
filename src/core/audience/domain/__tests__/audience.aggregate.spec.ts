import { Audience, AudienceId } from "../audience.aggregate";
import { Email, Phone, AudiencePoints } from "@core/shared/domain";

describe("Audience Without Validator Unit Tests", () => {
  beforeEach(() => {
    Audience.prototype.validate = jest
      .fn()
      .mockImplementation(Audience.prototype.validate);
  });

  test("constructor of audience", () => {
    let audience = new Audience({
      name: "John Doe",
      email: new Email("john@example.com"),
    });
    expect(audience.id).toBeInstanceOf(AudienceId);
    expect(audience.name).toBe("John Doe");
    expect(audience.email).toBeInstanceOf(Email);
    expect(audience.email.value).toBe("john@example.com");
    expect(audience.nickname).toBeNull();
    expect(audience.avatar).toBeNull();
    expect(audience.phone).toBeNull();
    expect(audience.favorite_genres).toEqual([]);
    expect(audience.points).toBeInstanceOf(AudiencePoints);
    expect(audience.points.total).toBe(0);
    expect(audience.is_active).toBe(true);
    expect(audience.created_at).toBeInstanceOf(Date);

    const created_at = new Date();
    audience = new Audience({
      name: "Jane Doe",
      email: new Email("jane@example.com"),
      nickname: "jane_doe",
      avatar: "avatar.jpg",
      phone: new Phone("+5511999999999"),
      preferences: {
        favorite_genres: ["Rock", "Jazz"],
      },
      is_active: false,
      created_at,
    });
    expect(audience.id).toBeInstanceOf(AudienceId);
    expect(audience.name).toBe("Jane Doe");
    expect(audience.email.value).toBe("jane@example.com");
    expect(audience.nickname).toBe("jane_doe");
    expect(audience.avatar).toBe("avatar.jpg");
    expect(audience.phone).toBeInstanceOf(Phone);
    expect(audience.phone?.value).toBe("+5511999999999");
    expect(audience.favorite_genres).toEqual(["Rock", "Jazz"]);
    expect(audience.is_active).toBe(false);
    expect(audience.created_at).toBe(created_at);
  });

  describe("create command", () => {
    test("should create an audience", () => {
      const audience = Audience.create({
        name: "John Doe",
        email: "john@example.com",
      });
      expect(audience.id).toBeInstanceOf(AudienceId);
      expect(audience.name).toBe("John Doe");
      expect(audience.email.value).toBe("john@example.com");
      expect(audience.nickname).toBeNull();
      expect(audience.avatar).toBeNull();
      expect(audience.phone).toBeNull();
      expect(audience.favorite_genres).toEqual([]);
      expect(audience.points.total).toBe(0);
      expect(audience.is_active).toBe(true);
      expect(audience.created_at).toBeInstanceOf(Date);
      expect(Audience.prototype.validate).toHaveBeenCalledTimes(1);
      expect(audience.notification.hasErrors()).toBe(false);
    });

    test("should create an audience with all properties", () => {
      const audience = Audience.create({
        name: "Jane Doe",
        email: "jane@example.com",
        nickname: "jane_doe",
        avatar: "avatar.jpg",
        phone: "+5511999999999",
        favorite_genres: ["Rock", "Jazz"],
        is_active: false,
      });
      expect(audience.id).toBeInstanceOf(AudienceId);
      expect(audience.name).toBe("Jane Doe");
      expect(audience.email.value).toBe("jane@example.com");
      expect(audience.nickname).toBe("jane_doe");
      expect(audience.avatar).toBe("avatar.jpg");
      expect(audience.phone?.value).toBe("+5511999999999");
      expect(audience.favorite_genres).toEqual(["Rock", "Jazz"]);
      expect(audience.is_active).toBe(false);
      expect(audience.created_at).toBeInstanceOf(Date);
      expect(Audience.prototype.validate).toHaveBeenCalledTimes(1);
      expect(audience.notification.hasErrors()).toBe(false);
    });
  });

  describe("id field", () => {
    const arrange = [{ id: null }, { id: undefined }, { id: new AudienceId() }];

    test.each(arrange)("should be is %j", (props) => {
      const audience = new Audience({
        name: "John Doe",
        email: new Email("john@example.com"),
        ...props,
      } as any);
      expect(audience.id).toBeInstanceOf(AudienceId);
    });
  });

  test("should change name", () => {
    const audience = new Audience({
      name: "John Doe",
      email: new Email("john@example.com"),
    });
    audience.changeName("Jane Doe");
    expect(audience.name).toBe("Jane Doe");
    expect(Audience.prototype.validate).toHaveBeenCalledTimes(1);
    expect(audience.notification.hasErrors()).toBe(false);
  });

  test("should change email", () => {
    const audience = new Audience({
      name: "John Doe",
      email: new Email("john@example.com"),
    });
    audience.changeEmail("jane@example.com");
    expect(audience.email.value).toBe("jane@example.com");
    expect(Audience.prototype.validate).toHaveBeenCalledTimes(1);
    expect(audience.notification.hasErrors()).toBe(false);
  });

  test("should activate an audience", () => {
    const audience = new Audience({
      name: "John Doe",
      email: new Email("john@example.com"),
      is_active: false,
    });
    audience.activate();
    expect(audience.is_active).toBe(true);
    expect(audience.notification.hasErrors()).toBe(false);
  });

  test("should deactivate an audience", () => {
    const audience = new Audience({
      name: "John Doe",
      email: new Email("john@example.com"),
      is_active: true,
    });
    audience.deactivate();
    expect(audience.is_active).toBe(false);
    expect(audience.notification.hasErrors()).toBe(false);
  });

  test("should scan musician QR code", () => {
    const audience = Audience.fake().build();
    const musicianId = "musician-123";
    const musicianName = "John Doe";

    const initialPoints = audience.points.total;
    audience.scanMusicianQRCode(musicianId, musicianName);

    expect(audience.points.total).toBeGreaterThan(initialPoints);
    expect(audience.events.size).toBe(1);
    const event = Array.from(audience.events)[0];
    expect(event.constructor.name).toBe("MusicianQRCodeScannedEvent");
  });

  test("should make music request", () => {
    const audience = Audience.fake().build();
    const musicianId = "musician-123";
    const songTitle = "Bohemian Rhapsody";
    const artist = "Queen";

    const initialPoints = audience.points.total;
    audience.makeMusicRequest(musicianId, songTitle, artist);

    expect(audience.points.total).toBeGreaterThan(initialPoints);
    expect(audience.events.size).toBe(1);
    const event = Array.from(audience.events)[0];
    expect(event.constructor.name).toBe("MusicRequestMadeEvent");
  });

  test("should send tip", () => {
    const audience = Audience.fake().build();
    const musicianId = "musician-123";
    const amount = 10.5;
    const message = "Great performance!";

    const initialPoints = audience.points.total;
    audience.sendTip(musicianId, amount, message);

    expect(audience.points.total).toBeGreaterThan(initialPoints);
    expect(audience.events.size).toBe(1);
    const event = Array.from(audience.events)[0];
    expect(event.constructor.name).toBe("TipSentEvent");
  });

  test("should create audience with fake data", () => {
    const audience = Audience.fake().withNickname("test_nickname").build();

    expect(audience.id).toBeInstanceOf(AudienceId);
    expect(audience.name).toBeTruthy();
    expect(audience.email).toBeInstanceOf(Email);
    expect(audience.nickname).toBeTruthy();
    expect(audience.phone).toBeDefined();
    if (audience.phone) {
      expect(audience.phone).toBeInstanceOf(Phone);
    }
    expect(audience.avatar).toBeNull();
    expect(audience.points).toBeInstanceOf(AudiencePoints);
    expect(audience.points.total).toBe(0);
    expect(audience.is_active).toBe(true);
    expect(audience.created_at).toBeInstanceOf(Date);
  });

  test("should create audience with valid data", () => {
    const audience = Audience.create({
      name: "John Doe",
      email: "john@example.com",
      nickname: "johndoe",
      phone: "+5511999999999",
    });

    expect(audience.id).toBeInstanceOf(AudienceId);
    expect(audience.name).toBe("John Doe");
    expect(audience.email.value).toBe("john@example.com");
    expect(audience.nickname).toBe("johndoe");
    expect(audience.phone!.value).toBe("+5511999999999");
    expect(audience.avatar).toBeNull();
    expect(audience.points.total).toBe(0);
    expect(audience.is_active).toBe(true);
    expect(audience.created_at).toBeInstanceOf(Date);
  });

  test("should validate audience with invalid email", () => {
    expect(() => {
      Audience.create({
        name: "John Doe",
        email: "invalid-email",
        nickname: "johndoe",
      });
    }).toThrow("Invalid email format");
  });

  test("should validate audience with invalid phone", () => {
    expect(() => {
      const audience = Audience.create({
        name: "John Doe",
        email: "john@example.com",
        nickname: "johndoe",
        phone: "123", // Telefone muito curto, não atende ao padrão de 8-15 dígitos
      });
    }).toThrow("Invalid phone format");
  });

  test("should return json", () => {
    const audience = Audience.fake().build();

    const json = audience.toJSON();
    expect(json).toMatchObject({
      id: audience.id.id,
      name: audience.name,
      email: audience.email.value,
      nickname: audience.nickname,
      avatar: audience.avatar,
      phone: audience.phone?.value || null,
      points: {
        total: audience.points.total,
        monthly: audience.points.monthly,
        last_updated: audience.points.lastUpdated,
      },
      level: {
        level: audience.level.level,
        name: audience.level.name,
        min_points: audience.level.minPoints,
        max_points: audience.level.maxPoints,
        benefits: audience.level.benefits,
      },
      preferences: {
        favorite_genres: audience.preferences.favoriteGenres,
        favorite_artists: audience.preferences.favoriteArtists,
        preferred_languages: audience.preferences.preferredLanguages,
        notification_settings: audience.preferences.notificationSettings,
        privacy_settings: audience.preferences.privacySettings,
        music_discovery_settings: audience.preferences.musicDiscoverySettings,
      },
      is_active: audience.is_active,
      created_at: audience.created_at,
    });
  });
});

describe("Audience Validator", () => {
  describe("create command", () => {
    test("should an invalid audience with name property", () => {
      const audience = Audience.create({
        name: "t".repeat(256),
        email: "john@example.com",
      });

      expect(audience.notification.hasErrors()).toBe(true);
      expect(audience.notification).notificationContainsErrorMessages([
        {
          name: ["name must be shorter than or equal to 255 characters"],
        },
      ]);
    });

    test("should an invalid audience with email property", () => {
      expect(() => {
        Audience.create({
          name: "John Doe",
          email: "invalid-email",
        });
      }).toThrow("Invalid email format");
    });
  });

  describe("changeName method", () => {
    it("should a invalid audience using name property", () => {
      const audience = Audience.create({
        name: "John Doe",
        email: "john@example.com",
      });
      audience.changeName("t".repeat(256));
      expect(audience.notification.hasErrors()).toBe(true);
      expect(audience.notification).notificationContainsErrorMessages([
        {
          name: ["name must be shorter than or equal to 255 characters"],
        },
      ]);
    });
  });

  describe("changeEmail method", () => {
    it("should a invalid audience using email property", () => {
      const audience = Audience.create({
        name: "John Doe",
        email: "john@example.com",
      });
      expect(() => {
        audience.changeEmail("invalid-email");
      }).toThrow("Invalid email format");
    });
  });
});
