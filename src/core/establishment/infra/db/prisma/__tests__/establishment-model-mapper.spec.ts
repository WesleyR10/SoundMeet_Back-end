import { Establishment } from "../../../../domain/establishment.aggregate";
import { EstablishmentModel } from "../establishment-model";
import { EstablishmentModelMapper } from "../establishment-model-mapper";

describe("EstablishmentModelMapper Unit Tests", () => {
  describe("toModel", () => {
    it("should convert establishment entity to model", () => {
      const establishment = Establishment.fake().aEstablishment().build();
      const model = EstablishmentModelMapper.toModel(establishment);

      expect(model).toMatchObject({
        id: establishment.establishment_id.id,
        name: establishment.name,
        email: establishment.email.value,
        cnpj: establishment.cnpj?.value ?? null,
        description: establishment.description,
        avatar: establishment.avatar,
        phone: establishment.phone?.value || null,
        website: establishment.website,
        establishment_type: establishment.establishment_type,
        qr_code: establishment.qr_code?.code ?? null,
        rating: establishment.rating.value,
        total_ratings: establishment.total_ratings,
        is_active: establishment.is_active,
        is_verified: establishment.is_verified,
        created_at: establishment.created_at,
        updated_at: expect.any(Date),
      });
    });

    it("should handle establishment with minimal data", () => {
      const establishment = Establishment.fake()
        .aEstablishment()
        .withDescription(null)
        .withAvatar(null)
        .withPhone(null)
        .withWebsite(null)
        .build();

      const model = EstablishmentModelMapper.toModel(establishment);

      expect(model).toMatchObject({
        id: establishment.establishment_id.id,
        name: establishment.name,
        email: establishment.email.value,
        cnpj: establishment.cnpj?.value ?? null,
        description: null,
        avatar: null,
        phone: null,
        website: null,
        establishment_type: establishment.establishment_type,
        qr_code: establishment.qr_code?.code ?? null,
        rating: establishment.rating.value,
        total_ratings: establishment.total_ratings,
        is_active: establishment.is_active,
        is_verified: establishment.is_verified,
        created_at: establishment.created_at,
        updated_at: expect.any(Date),
      });
    });

    it("should handle establishment with all optional fields", () => {
      const establishment = Establishment.fake()
        .aEstablishment()
        .withDescription("Great place for live music")
        .withAvatar("https://example.com/avatar.jpg")
        .withPhone("11999999999")
        .withWebsite("https://rockbar.com")
        .build();

      const model = EstablishmentModelMapper.toModel(establishment);

      expect(model).toMatchObject({
        id: establishment.establishment_id.id,
        name: establishment.name,
        email: establishment.email.value,
        cnpj: establishment.cnpj?.value ?? null,
        description: "Great place for live music",
        avatar: "https://example.com/avatar.jpg",
        phone: "11999999999",
        website: "https://rockbar.com",
        establishment_type: establishment.establishment_type,
        qr_code: establishment.qr_code?.code ?? null,
        rating: establishment.rating.value,
        total_ratings: establishment.total_ratings,
        is_active: establishment.is_active,
        is_verified: establishment.is_verified,
        created_at: establishment.created_at,
        updated_at: expect.any(Date),
      });
    });
  });

  describe("toEntity", () => {
    it("should convert model to establishment entity", () => {
      const model: EstablishmentModel = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Rock Bar",
        email: "contact@rockbar.com",
        cnpj: "84244955000184",
        description: "Great place for live music",
        avatar: "https://example.com/avatar.jpg",
        phone: "11999999999",
        is_active: true,
        website: null,
        establishment_type: "bar",
        qr_code: null,
        rating: 0,
        total_ratings: 0,
        is_verified: false,
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2023-01-01"),
      };

      const establishment = EstablishmentModelMapper.toEntity(model);

      expect(establishment.establishment_id.id).toBe(model.id);
      expect(establishment.name).toBe(model.name);
      expect(establishment.email.value).toBe(model.email);
      expect(establishment.cnpj?.value).toBe(model.cnpj);
      expect(establishment.description).toBe(model.description);
      expect(establishment.avatar).toBe(model.avatar);
      expect(establishment.phone?.value).toBe(model.phone);
      expect(establishment.website).toBeNull();
      expect(establishment.establishment_type).toBe("bar");
      expect(establishment.rating.value).toBe(0);
      expect(establishment.total_ratings).toBe(0);
      expect(establishment.is_active).toBe(model.is_active);
      expect(establishment.is_verified).toBe(model.is_verified);
      expect(establishment.created_at).toEqual(model.created_at);
    });

    it("should handle model with null optional fields", () => {
      const model: EstablishmentModel = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Rock Bar",
        email: "contact@rockbar.com",
        cnpj: "84244955000184",
        description: null,
        avatar: null,
        phone: null,
        is_active: true,
        website: null,
        establishment_type: "bar",
        qr_code: null,
        rating: 0,
        total_ratings: 0,
        is_verified: false,
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2023-01-01"),
      };

      const establishment = EstablishmentModelMapper.toEntity(model);

      expect(establishment.establishment_id.id).toBe(model.id);
      expect(establishment.name).toBe(model.name);
      expect(establishment.email.value).toBe(model.email);
      expect(establishment.cnpj?.value).toBe(model.cnpj);
      expect(establishment.description).toBeNull();
      expect(establishment.avatar).toBeNull();
      expect(establishment.phone).toBeNull();
      expect(establishment.website).toBeNull();
      expect(establishment.establishment_type).toBe("bar");
      expect(establishment.rating.value).toBe(0);
      expect(establishment.is_active).toBe(true);
      expect(establishment.is_verified).toBe(false);
      expect(establishment.created_at).toEqual(model.created_at);
      expect(establishment.updated_at).toEqual(model.updated_at);
    });

    it("should handle inactive establishment", () => {
      const model: EstablishmentModel = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Inactive Bar",
        email: "contact@inactivebar.com",
        cnpj: "90441272000110",
        description: "Temporarily closed",
        avatar: null,
        phone: null,
        is_active: false,
        website: null,
        establishment_type: "bar",
        qr_code: null,
        rating: 0,
        total_ratings: 0,
        is_verified: true,
        created_at: new Date("2023-01-01"),
        updated_at: new Date("2023-01-01"),
      };

      const establishment = EstablishmentModelMapper.toEntity(model);

      expect(establishment.is_active).toBe(false);
      expect(establishment.is_verified).toBe(true);
      expect(establishment.rating.value).toBe(0);
      expect(establishment.total_ratings).toBe(0);
      expect(establishment.updated_at).toEqual(model.updated_at);
    });
  });

  describe("bidirectional conversion", () => {
    it("should maintain data integrity in both directions", () => {
      const originalEstablishment = Establishment.fake()
        .aEstablishment()
        .withDescription("Test description")
        .withAvatar("https://example.com/avatar.jpg")
        .withPhone("11999999999")
        .withWebsite("https://test.com")
        .withRating(4.2)
        .withTotalRatings(85)
        .build();

      const model = EstablishmentModelMapper.toModel(originalEstablishment);
      const convertedEstablishment = EstablishmentModelMapper.toEntity(model);

      expect(convertedEstablishment.establishment_id.id).toBe(
        originalEstablishment.establishment_id.id,
      );
      expect(convertedEstablishment.name).toBe(originalEstablishment.name);
      expect(convertedEstablishment.email.value).toBe(
        originalEstablishment.email.value,
      );
      expect(convertedEstablishment.cnpj?.value).toBe(
        originalEstablishment.cnpj?.value,
      );
      expect(convertedEstablishment.description).toBe(
        originalEstablishment.description,
      );
      expect(convertedEstablishment.avatar).toBe(originalEstablishment.avatar);
      expect(convertedEstablishment.phone?.value).toBe(
        originalEstablishment.phone?.value,
      );
      expect(convertedEstablishment.website).toBe(
        originalEstablishment.website,
      );
      expect(convertedEstablishment.establishment_type).toBe(
        originalEstablishment.establishment_type,
      );
      expect(convertedEstablishment.qr_code?.code ?? null).toBe(
        originalEstablishment.qr_code?.code ?? null,
      );
      expect(convertedEstablishment.rating.value).toBe(
        originalEstablishment.rating.value,
      );
      expect(convertedEstablishment.total_ratings).toBe(
        originalEstablishment.total_ratings,
      );
      expect(convertedEstablishment.is_active).toBe(
        originalEstablishment.is_active,
      );
      expect(convertedEstablishment.is_verified).toBe(
        originalEstablishment.is_verified,
      );
      expect(convertedEstablishment.created_at).toEqual(
        originalEstablishment.created_at,
      );
      expect(convertedEstablishment.updated_at).toEqual(
        originalEstablishment.updated_at,
      );
    });
  });
});
