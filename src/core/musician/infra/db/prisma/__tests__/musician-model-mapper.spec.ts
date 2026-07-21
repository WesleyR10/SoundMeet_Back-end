import { Email } from "../../../../../shared/domain/value-objects/email.vo";
import { Phone } from "../../../../../shared/domain/value-objects/phone.vo";
import { QRCode } from "../../../../../shared/domain/value-objects/qr-code.vo";
import { Rating } from "../../../../../shared/domain/value-objects/rating.vo";
import { Musician, MusicianId } from "../../../../domain/musician.aggregate";
import { MusicianModel } from "../musician-model";
import { MusicianModelMapper } from "../musician-model-mapper";

describe("MusicianModelMapper", () => {
  describe("toModel", () => {
    it("should convert entity to model with all properties", () => {
      const musician = Musician.fake()
        .aMusician()
        .withName("John Doe")
        .withStageName("Johnny")
        .withEmail("john@example.com")
        .withBio("Musician bio")
        .withAvatar("avatar.jpg")
        .withPhone("+5511999999999")
        .withGenres(["Rock", "Pop"])
        .withInstruments(["Guitar", "Piano"])
        .withExperienceYears(5)

        .activate()
        .build();

      musician.verify();

      const model = MusicianModelMapper.toModel(musician);

      expect(model).toEqual({
        id: musician.musician_id.id,
        email: musician.email.value,
        name: musician.name,
        stage_name: musician.stage_name,
        bio: musician.bio,
        avatar: musician.avatar,
        phone: musician.phone?.value,
        cpf: musician.cpf?.value ?? null,
        genres: musician.genres,
        instruments: musician.instruments,
        experience_years: musician.experience_years,
        qr_code: musician.qr_code?.code,
        qr_foreground_color: null,
        qr_background_color: null,
        qr_logo_url: null,
        qr_label: null,
        push_token: null,
        push_token_platform: null,
        rating: musician.rating.value,
        total_ratings: musician.total_ratings,
        is_active: musician.is_active,
        is_verified: musician.is_verified,
        open_to_gigs: musician.open_to_gigs,
        created_at: musician.created_at,
        updated_at: musician.updated_at,
      });
    });

    it("should convert entity to model with minimal properties", () => {
      const musician = Musician.fake()
        .aMusician()
        .withName("Jane Doe")
        .withEmail("jane@example.com")
        .build();

      const model = MusicianModelMapper.toModel(musician);

      expect(model).toEqual({
        id: musician.musician_id.id,
        email: musician.email.value,
        name: musician.name,
        stage_name: null,
        bio: null,
        avatar: null,
        phone: null,
        cpf: null,
        genres: musician.genres, // Fake builder generates ['Rock', 'Pop']
        instruments: musician.instruments, // Fake builder generates ['Guitar', 'Piano']
        experience_years: musician.experience_years, // Fake builder generates random number
        qr_code: musician.qr_code?.code ?? null,
        qr_foreground_color: null,
        qr_background_color: null,
        qr_logo_url: null,
        qr_label: null,
        push_token: null,
        push_token_platform: null,
        rating: musician.rating.value,
        total_ratings: musician.total_ratings,
        is_active: musician.is_active,
        is_verified: musician.is_verified,
        open_to_gigs: musician.open_to_gigs,
        created_at: musician.created_at,
        updated_at: musician.updated_at,
      });
    });

    it("should handle null optional properties correctly", () => {
      const musician = new Musician({
        musician_id: new MusicianId(),
        email: "test@example.com",
        name: "Test Musician",
        stage_name: undefined,
        bio: undefined,
        avatar: undefined,
        phone: undefined,
        genres: [],
        instruments: [],
        experience_years: undefined,
        qr_code: undefined,
        rating: 0,
        total_ratings: 0,
        is_active: true,
        is_verified: false,
        created_at: new Date(),
      });

      const model = MusicianModelMapper.toModel(musician);

      expect(model.stage_name).toBeNull();
      expect(model.bio).toBeNull();
      expect(model.avatar).toBeNull();
      expect(model.phone).toBeNull();
      expect(model.genres).toEqual([]);
      expect(model.instruments).toEqual([]);
      expect(model.experience_years).toBe(0);
      expect(model.qr_code).toBeNull();
    });
  });

  describe("toEntity", () => {
    it("should convert model to entity with all properties", () => {
      const musicianId = new MusicianId();
      const created_at = new Date();
      const updated_at = new Date(created_at.getTime() + 1000);

      const model: MusicianModel = {
        id: musicianId.id,
        email: "john@example.com",
        name: "John Doe",
        stage_name: "Johnny",
        bio: "Musician bio",
        avatar: "avatar.jpg",
        phone: "+5511999999999",
        cpf: "52998224725",
        genres: ["Rock", "Pop"],
        instruments: ["Guitar", "Piano"],
        experience_years: 5,
        qr_code: "qr-code-123",
        rating: 4.5,
        total_ratings: 10,
        is_active: true,
        is_verified: true,
        open_to_gigs: null,
        created_at: created_at,
        updated_at: updated_at,
        profile: null,
      };

      const entity = MusicianModelMapper.toEntity(model);

      expect(entity.musician_id.id).toBe(model.id);
      expect(entity.email.value).toBe(model.email);
      expect(entity.name).toBe(model.name);
      expect(entity.stage_name).toBe(model.stage_name);
      expect(entity.bio).toBe(model.bio);
      expect(entity.avatar).toBe(model.avatar);
      expect(entity.phone?.value).toBe(model.phone);
      expect(entity.cpf?.value).toBe(model.cpf);
      expect(entity.genres).toEqual(model.genres);
      expect(entity.instruments).toEqual(model.instruments);
      expect(entity.experience_years).toBe(model.experience_years);
      expect(entity.qr_code?.code).toBe(model.qr_code);
      expect(entity.rating.value).toBe(model.rating);
      expect(entity.total_ratings).toBe(model.total_ratings);
      expect(entity.is_active).toBe(model.is_active);
      expect(entity.is_verified).toBe(model.is_verified);
      expect(entity.created_at).toBe(model.created_at);
    });

    it("should round-trip QR Code customization through toModel/toEntity", () => {
      const musician = Musician.fake()
        .aMusician()
        .withName("John Doe")
        .withEmail("john@example.com")
        .build();

      musician.customizeQRCode({
        foreground_color: "#111111",
        background_color: "#ffffff",
        logo_url: "https://cdn.example.com/logo.png",
        label: "Peça uma música!",
      });

      const model: MusicianModel = {
        ...MusicianModelMapper.toModel(musician),
        profile: null,
      };

      const reidratado = MusicianModelMapper.toEntity(model);

      expect(reidratado.qr_code?.customization).toEqual({
        foreground_color: "#111111",
        background_color: "#ffffff",
        logo_url: "https://cdn.example.com/logo.png",
        label: "Peça uma música!",
      });
    });

    it("should not fabricate a customization object when no QR field is set", () => {
      const musicianId = new MusicianId();
      const model: MusicianModel = {
        id: musicianId.id,
        email: "jane@example.com",
        name: "Jane Doe",
        stage_name: null,
        bio: null,
        avatar: null,
        phone: null,
        cpf: null,
        genres: [],
        instruments: [],
        experience_years: null,
        qr_code: "soundmeet://musician/" + musicianId.id,
        rating: 0,
        total_ratings: 0,
        is_active: true,
        is_verified: false,
        open_to_gigs: null,
        created_at: new Date(),
        updated_at: new Date(),
        profile: null,
      };

      const entity = MusicianModelMapper.toEntity(model);

      expect(entity.qr_code?.customization).toBeUndefined();
    });

    it("should convert model to entity with minimal properties", () => {
      const musicianId = new MusicianId();
      const created_at = new Date();
      const updated_at = new Date(created_at.getTime() + 1000);

      const model: MusicianModel = {
        id: musicianId.id,
        email: "jane@example.com",
        name: "Jane Doe",
        stage_name: null,
        bio: null,
        avatar: null,
        phone: null,
        cpf: null,
        genres: [],
        instruments: [],
        experience_years: null,
        qr_code: null,
        rating: 0,
        total_ratings: 0,
        is_active: true,
        is_verified: false,
        open_to_gigs: null,
        created_at: created_at,
        updated_at: updated_at,
        profile: null,
      };

      const entity = MusicianModelMapper.toEntity(model);

      expect(entity.musician_id.id).toBe(model.id);
      expect(entity.email.value).toBe(model.email);
      expect(entity.name).toBe(model.name);
      expect(entity.stage_name).toBeNull();
      expect(entity.bio).toBeNull();
      expect(entity.avatar).toBeNull();
      expect(entity.phone).toBeNull();
      expect(entity.cpf).toBeNull();
      expect(entity.genres).toEqual([]);
      expect(entity.instruments).toEqual([]);
      expect(entity.experience_years).toBe(0);
      expect(entity.qr_code).toBeNull();
      expect(entity.rating.value).toBe(model.rating);
      expect(entity.total_ratings).toBe(model.total_ratings);
      expect(entity.is_active).toBe(model.is_active);
      expect(entity.is_verified).toBe(model.is_verified);
      expect(entity.created_at).toBe(model.created_at);
    });

    it("should handle null values correctly", () => {
      const created_at = new Date();
      const updated_at = new Date(created_at.getTime() + 1000);
      const model: MusicianModel = {
        id: new MusicianId().id,
        email: "test@example.com",
        name: "Test Musician",
        stage_name: null,
        bio: null,
        avatar: null,
        phone: null,
        cpf: null,
        genres: null as any,
        instruments: null as any,
        experience_years: null,
        qr_code: null,
        rating: 0,
        total_ratings: 0,
        is_active: true,
        is_verified: false,
        open_to_gigs: null,
        created_at: created_at,
        updated_at: updated_at,
        profile: null,
      };

      const entity = MusicianModelMapper.toEntity(model);

      expect(entity.stage_name).toBeNull();
      expect(entity.bio).toBeNull();
      expect(entity.avatar).toBeNull();
      expect(entity.phone).toBeNull();
      expect(entity.genres).toEqual([]);
      expect(entity.instruments).toEqual([]);
      expect(entity.experience_years).toBe(0);
      expect(entity.qr_code).toBeNull();
    });

    it("should create proper value objects", () => {
      const created_at = new Date();
      const updated_at = new Date(created_at.getTime() + 1000);
      const model: MusicianModel = {
        id: new MusicianId().id,
        email: "test@example.com",
        name: "Test Musician",
        stage_name: null,
        bio: null,
        avatar: null,
        phone: "+5511999999999",
        cpf: "52998224725",
        genres: ["Rock"],
        instruments: ["Guitar"],
        experience_years: null,
        qr_code: "qr-code-123",
        rating: 4.5,
        total_ratings: 0,
        is_active: true,
        is_verified: false,
        open_to_gigs: null,
        created_at: created_at,
        updated_at: updated_at,
        profile: null,
      };

      const entity = MusicianModelMapper.toEntity(model);

      expect(entity.musician_id).toBeInstanceOf(MusicianId);
      expect(entity.email).toBeInstanceOf(Email);
      expect(entity.phone).toBeInstanceOf(Phone);
      expect(entity.qr_code).toBeInstanceOf(QRCode);
      expect(entity.rating).toBeInstanceOf(Rating);
    });
  });

  describe("bidirectional conversion", () => {
    it("should maintain data integrity in both directions", () => {
      const originalMusician = Musician.fake()
        .aMusician()
        .withName("John Doe")
        .withStageName("Johnny")
        .withEmail("john@example.com")
        .withBio("Musician bio")
        .withAvatar("avatar.jpg")
        .withPhone("+5511999999999")
        .withGenres(["Rock", "Pop"])
        .withInstruments(["Guitar", "Piano"])
        .withExperienceYears(5)

        .activate()
        .build();

      originalMusician.verify();

      const model = MusicianModelMapper.toModel(originalMusician);
      const convertedMusician = MusicianModelMapper.toEntity(model);

      expect(
        convertedMusician.musician_id.equals(originalMusician.musician_id),
      ).toBe(true);
      expect(convertedMusician.email.equals(originalMusician.email)).toBe(true);
      expect(convertedMusician.name).toBe(originalMusician.name);
      expect(convertedMusician.stage_name).toBe(originalMusician.stage_name);
      expect(convertedMusician.bio).toBe(originalMusician.bio);
      expect(convertedMusician.avatar).toBe(originalMusician.avatar);
      expect(convertedMusician.phone?.equals(originalMusician.phone!)).toBe(
        true,
      );
      expect(convertedMusician.genres).toEqual(originalMusician.genres);
      expect(convertedMusician.instruments).toEqual(
        originalMusician.instruments,
      );
      expect(convertedMusician.experience_years).toBe(
        originalMusician.experience_years,
      );
      expect(convertedMusician.qr_code?.equals(originalMusician.qr_code!)).toBe(
        true,
      );
      expect(convertedMusician.rating.equals(originalMusician.rating)).toBe(
        true,
      );
      expect(convertedMusician.total_ratings).toBe(
        originalMusician.total_ratings,
      );
      expect(convertedMusician.is_active).toBe(originalMusician.is_active);
      expect(convertedMusician.is_verified).toBe(originalMusician.is_verified);
      expect(convertedMusician.created_at).toEqual(originalMusician.created_at);
    });
  });
});
