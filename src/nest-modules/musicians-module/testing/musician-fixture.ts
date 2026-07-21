import { Musician } from "../../../core/musician/domain/musician.aggregate";

const _keysInResponse = [
  "id",
  "email",
  "name",
  "stage_name",
  "bio",
  "avatar",
  "phone",
  "genres",
  "instruments",
  "experience_years",
  "qr_code",
  "rating",
  "total_ratings",
  "is_active",
  "is_verified",
  "profile",
  "display_name",
  "is_experienced",
  "is_highly_rated",
  "created_at",
  "updated_at",
];

export class GetMusicianFixture {
  static keysInResponse = _keysInResponse;
}

export class CreateMusicianFixture {
  static keysInResponse = _keysInResponse;

  static arrangeForCreate() {
    const faker = Musician.fake()
      .aMusician()
      .withName("John Doe")
      .withEmail("john@example.com")
      .withPhone("11999999999")
      .withGenres(["Rock", "Blues"])
      .withInstruments(["Guitar", "Piano"])
      .withStageName("Johnny Rock")
      .withBio("Professional musician")
      .withExperienceYears(10)
      .activate();

    return [
      {
        send_data: {
          name: faker.name,
          email: faker.email,
        },
        expected: {
          name: faker.name,
          email: faker.email,
          stage_name: null,
          bio: null,
          avatar: null,
          phone: null,
          genres: [],
          instruments: [],
          experience_years: 0,
          is_active: true,
          is_verified: false,
          rating: 0,
          total_ratings: 0,
        },
      },
      {
        send_data: {
          name: faker.name,
          email: faker.email,
          phone: faker.phone,
          genres: faker.genres,
          instruments: faker.instruments,
          stage_name: faker.stage_name,
          bio: faker.bio,
          experience_years: faker.experience_years,
          is_active: true,
        },
        expected: {
          name: faker.name,
          email: faker.email,
          stage_name: faker.stage_name,
          bio: faker.bio,
          avatar: null,
          phone: faker.phone,
          genres: faker.genres,
          instruments: faker.instruments,
          experience_years: faker.experience_years,
          is_active: true,
          is_verified: false,
          rating: 0,
          total_ratings: 0,
        },
      },
      {
        send_data: {
          name: faker.name,
          email: faker.email,
          is_active: false,
        },
        expected: {
          name: faker.name,
          email: faker.email,
          stage_name: null,
          bio: null,
          avatar: null,
          phone: null,
          genres: [],
          instruments: [],
          experience_years: 0,
          is_active: false,
          is_verified: false,
          rating: 0,
          total_ratings: 0,
        },
      },
    ];
  }

  static arrangeInvalidRequest() {
    const defaultExpected = {
      statusCode: 422,
      error: "Unprocessable Entity",
    };

    return {
      EMPTY: {
        send_data: {},
        expected: {
          message: [
            "email should not be empty",
            "email must be an email",
            "name should not be empty",
            "name must be a string",
          ],
          ...defaultExpected,
        },
      },
      EMAIL_INVALID: {
        send_data: {
          name: "John",
          email: "invalid-email",
        },
        expected: {
          message: ["email must be an email"],
          ...defaultExpected,
        },
      },
      NAME_EMPTY: {
        send_data: {
          name: "",
          email: "john@example.com",
        },
        expected: {
          message: ["name should not be empty"],
          ...defaultExpected,
        },
      },
      GENRES_NOT_ARRAY: {
        send_data: {
          name: "John",
          email: "john@example.com",
          genres: "Rock",
        },
        expected: {
          message: ["genres must be an array"],
          ...defaultExpected,
        },
      },
      EXPERIENCE_NOT_NUMBER: {
        send_data: {
          name: "John",
          email: "john@example.com",
          experience_years: "10",
        },
        expected: {
          message: [
            "experience_years must be a number conforming to the specified constraints",
          ],
          ...defaultExpected,
        },
      },
    };
  }
}

export class UpdateMusicianFixture {
  static keysInResponse = _keysInResponse;

  static arrangeForUpdate() {
    const faker = Musician.fake()
      .aMusician()
      .withName("Updated Name")
      .withStageName("Updated Stage")
      .withBio("Updated bio")
      .withAvatar("https://cdn.example.com/avatar.png")
      .withPhone("11888888888")
      .withGenres(["Jazz"])
      .withInstruments(["Piano"])
      .withExperienceYears(5);

    return [
      {
        send_data: {
          name: faker.name,
          stage_name: faker.stage_name,
          bio: faker.bio,
          avatar: faker.avatar,
          phone: faker.phone,
          genres: faker.genres,
          instruments: faker.instruments,
          experience_years: faker.experience_years,
          is_active: false,
        },
        expected: {
          name: faker.name,
          stage_name: faker.stage_name,
          bio: faker.bio,
          avatar: faker.avatar,
          phone: faker.phone,
          genres: faker.genres,
          instruments: faker.instruments,
          experience_years: faker.experience_years,
          is_active: false,
        },
      },
      {
        send_data: {
          bio: null,
          stage_name: null,
        },
        expected: {
          bio: null,
          stage_name: null,
        },
      },
    ];
  }

  static arrangeInvalidRequest() {
    const defaultExpected = {
      statusCode: 422,
      error: "Unprocessable Entity",
    };

    return {
      EXPERIENCE_NOT_NUMBER: {
        send_data: {
          experience_years: "10",
        },
        expected: {
          message: [
            "experience_years must be a number conforming to the specified constraints",
          ],
          ...defaultExpected,
        },
      },
      IS_ACTIVE_NOT_BOOLEAN: {
        send_data: {
          is_active: "a",
        },
        expected: {
          message: ["is_active must be a boolean value"],
          ...defaultExpected,
        },
      },
    };
  }

  static arrangeForEntityValidationError() {
    const faker = Musician.fake().aMusician();
    const defaultExpected = {
      statusCode: 422,
      error: "Unprocessable Entity",
    };

    return {
      NAME_TOO_LONG: {
        send_data: {
          name: faker.withInvalidNameTooLong().name,
        },
        expected: {
          message: ["name must be shorter than or equal to 255 characters"],
          ...defaultExpected,
        },
      },
      EMAIL_INVALID: {
        send_data: {
          email: faker.withInvalidEmailFormat().email,
        },
        expected: {
          message: ["email must be an email"],
          ...defaultExpected,
        },
      },
    };
  }
}

export class ListMusiciansFixture {
  static arrangeIncrementedWithCreatedAt() {
    const base = new Date("2024-01-01T00:00:00.000Z").getTime();

    const _entities = Musician.fake()
      .theMusicians(4)
      .withName((i) => `name-${i}`)
      .withEmail((i) => `user-${i}@example.com`)
      .withcreated_at((i) => new Date(base + i * 2000))
      .withOpenToGigs(true)
      .build();

    const entitiesMap = {
      first: _entities[0],
      second: _entities[1],
      third: _entities[2],
      fourth: _entities[3],
    };

    const arrange = [
      {
        send_data: {},
        expected: {
          entities: [
            entitiesMap.fourth,
            entitiesMap.third,
            entitiesMap.second,
            entitiesMap.first,
          ],
          meta: {
            current_page: 1,
            last_page: 1,
            per_page: 15,
            total: 4,
          },
        },
      },
      {
        send_data: {
          page: 1,
          per_page: 2,
        },
        expected: {
          entities: [entitiesMap.fourth, entitiesMap.third],
          meta: {
            current_page: 1,
            last_page: 2,
            per_page: 2,
            total: 4,
          },
        },
      },
      {
        send_data: {
          page: 2,
          per_page: 2,
        },
        expected: {
          entities: [entitiesMap.second, entitiesMap.first],
          meta: {
            current_page: 2,
            last_page: 2,
            per_page: 2,
            total: 4,
          },
        },
      },
    ];

    return { arrange, entitiesMap };
  }

  static arrangeUnsorted() {
    const faker = Musician.fake().aMusician().withOpenToGigs(true);

    const entitiesMap = {
      a: faker.withName("a").withEmail("a@example.com").build(),
      AAA: faker.withName("AAA").withEmail("aaa@example.com").build(),
      AaA: faker.withName("AaA").withEmail("aaa2@example.com").build(),
      b: faker.withName("b").withEmail("b@example.com").build(),
      c: faker.withName("c").withEmail("c@example.com").build(),
    };

    const arrange = [
      {
        send_data: {
          page: 1,
          per_page: 2,
          sort: "name",
          filter: { name: "a" },
        },
        expected: {
          entities: [entitiesMap.AAA, entitiesMap.AaA],
          meta: {
            total: 3,
            current_page: 1,
            last_page: 2,
            per_page: 2,
          },
        },
      },
      {
        send_data: {
          page: 2,
          per_page: 2,
          sort: "name",
          filter: { name: "a" },
        },
        expected: {
          entities: [entitiesMap.a],
          meta: {
            total: 3,
            current_page: 2,
            last_page: 2,
            per_page: 2,
          },
        },
      },
    ];

    return { arrange, entitiesMap };
  }
}
