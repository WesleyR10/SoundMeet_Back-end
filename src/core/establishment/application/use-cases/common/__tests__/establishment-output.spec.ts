import { EstablishmentOutputMapper } from "../establishment-output";
import { EstablishmentFakeBuilder } from "../../../../domain/establishment-fake.builder";

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

    const spyToJSON = jest.spyOn(entity, "toJSON");
    const output = EstablishmentOutputMapper.toOutput(entity);

    expect(spyToJSON).toHaveBeenCalled();
    expect(output).toStrictEqual({
      id: entity.id.id,
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
      address_street: entity.address.street,
      address_number: entity.address.number,
      address_neighborhood: entity.address.neighborhood,
      address_city: entity.address.city,
      address_state: entity.address.state,
      address_zipcode: entity.address.zipCode,
      establishment_type: entity.establishment_type,
      rating: entity.rating.value,
      total_ratings: entity.total_ratings,
      is_active: entity.is_active,
      is_verified: entity.is_verified,
      is_highly_rated: entity.isHighlyRated,
      is_popular: entity.isPopular,
      is_bar: entity.isBar,
      is_restaurant: entity.isRestaurant,
      is_club: entity.isClub,
      created_at: entity.created_at,
      qr_code: expect.any(String),
    });

    // Verify QR code contains establishment URL
    expect(output.qr_code).toMatch(/^soundmeet:\/\/establishment\/[a-f0-9-]+$/);
  });
});
