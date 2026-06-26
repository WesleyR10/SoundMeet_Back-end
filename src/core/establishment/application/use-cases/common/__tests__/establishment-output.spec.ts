import { Address } from "../../../../../shared/domain/value-objects/address.vo";
import { SocialLinks } from "../../../../../shared/domain/value-objects/social-links.vo";
import { EstablishmentFakeBuilder } from "../../../../domain/establishment-fake.builder";
import { EstablishmentOutputMapper } from "../establishment-output";

describe("EstablishmentOutputMapper Unit Tests", () => {
  it("should convert an establishment in output", () => {
    const entity = EstablishmentFakeBuilder.anEstablishment()
      .withName("Test Restaurant")
      .withEmail("test@restaurant.com")
      .withCnpj("12345678000195")
      .withDescription("A great restaurant")
      .withAvatar("https://example.com/avatar.jpg")
      .withPhone("+5511999999999")
      .build();

    const output = EstablishmentOutputMapper.toOutput(entity);

    expect(output).toStrictEqual({
      id: entity.establishment_id.id,
      name: "Test Restaurant",
      description: "A great restaurant",
      avatar: "https://example.com/avatar.jpg",
      cnpj: {
        formatted: "12.345.678/0001-95",
        value: "12345678000195",
      },
      email: entity.email.value,
      phone: entity.phone?.value || null,
      website: entity.website,
      establishment_type: entity.establishment_type,
      rating: entity.rating.value,
      total_ratings: entity.total_ratings,
      is_active: entity.is_active,
      is_verified: entity.is_verified,
      profile: null,
      is_highly_rated: entity.isHighlyRated,
      is_popular: entity.isPopular,
      is_bar: entity.isBar,
      is_restaurant: entity.isRestaurant,
      is_club: entity.isClub,
      is_open_now: false,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      qr_code: expect.any(String),
    });

    // Verify QR code contains establishment URL
    expect(output.qr_code).toMatch(/^soundmeet:\/\/establishment\/[a-f0-9-]+$/);
  });

  it("should convert an establishment with profile social links", () => {
    const entity = EstablishmentFakeBuilder.anEstablishment().build();
    const profile = entity.ensureProfile(
      new Address({
        street: "Rua A",
        number: "10",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        zipCode: "01001000",
      }),
    );

    profile.changeSocialLinks(
      SocialLinks.create([
        {
          platform: "instagram",
          username: "bar",
          url: "https://www.instagram.com/bar",
        },
      ]),
    );

    const output = EstablishmentOutputMapper.toOutput(entity);

    expect(output.profile).toBeTruthy();
    expect(output.profile!.social_links).toStrictEqual({
      links: [
        {
          platform: "instagram",
          username: "bar",
          url: "https://www.instagram.com/bar",
          isVerified: false,
          followersCount: 0,
        },
      ],
      platforms: ["instagram"],
      totalFollowers: 0,
      verifiedCount: 0,
      isEmpty: false,
      size: 1,
    });
  });
});
