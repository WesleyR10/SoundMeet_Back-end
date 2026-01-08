import { Band } from "../../../core/musician/domain/band.aggregate";

const _keysInResponse = [
  "id",
  "name",
  "description",
  "avatar",
  "genres",
  "members",
  "priceRange",
  "is_active",
  "created_at",
  "updated_at",
];

export class GetBandFixture {
  static keysInResponse = _keysInResponse;
}

export class CreateBandFixture {
  static keysInResponse = _keysInResponse;

  static arrangeForCreate() {
    const faker = Band.fake()
      .aBand()
      .withName("The Rockers")
      .withDescription("A rock band")
      .withGenres(["Rock"])
      .withIsActive(true);

    return [
      {
        send_data: {
          name: faker.name,
          genres: faker.genres,
        },
        expected: {
          name: faker.name,
          description: null,
          avatar: null,
          genres: faker.genres,
          members: [],
          priceRange: null,
          is_active: true,
        },
      },
      {
        send_data: {
          name: faker.name,
          description: faker.description,
          genres: faker.genres,
          is_active: false,
        },
        expected: {
          name: faker.name,
          description: faker.description,
          avatar: null,
          genres: faker.genres,
          members: [],
          priceRange: null,
          is_active: false,
        },
      },
      {
        send_data: {
          name: faker.name,
          description: faker.description,
          genres: faker.genres,
          priceRange: {
            model: "per_event",
            min: 200,
            max: 400,
            currency: "BRL",
            notes: "Som incluso",
          },
        },
        expected: {
          name: faker.name,
          description: faker.description,
          avatar: null,
          genres: faker.genres,
          members: [],
          priceRange: {
            model: "per_event",
            min: 200,
            max: 400,
            currency: "BRL",
            notes: "Som incluso",
          },
          is_active: true,
        },
      },
    ];
  }
}
