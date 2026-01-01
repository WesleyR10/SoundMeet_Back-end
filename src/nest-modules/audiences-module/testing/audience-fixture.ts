import { Audience } from "../../../core/audience/domain/audience.aggregate";

const _keysInResponse = [
  "id",
  "email",
  "name",
  "nickname",
  "avatar",
  "phone",
  "badges",
  "points",
  "level",
  "preferences",
  "notification_settings",
  "privacy_settings",
  "discovery_settings",
  "favorite_genres",
  "favorite_artists",
  "favorite_instruments",
  "is_active",
  "created_at",
  "updated_at",
  "display_name",
  "current_level",
  "level_name",
  "points_to_next_level",
  "max_requests_per_event",
  "has_vip_access",
  "can_access_exclusive_content",
  "is_profile_complete",
  "is_highly_engaged",
  "is_new_user",
];

export class GetAudienceFixture {
  static keysInResponse = _keysInResponse;
}

export class CreateAudienceFixture {
  static keysInResponse = _keysInResponse;

  static arrangeForCreate() {
    const faker = Audience.fake()
      .aAudience()
      .withName("John Doe")
      .withEmail("john@example.com")
      .withPhone("11999999999")
      .withFavoriteGenres(["Rock", "Blues"])
      .withFavoriteArtists(["The Beatles"])
      .withFavoriteInstruments(["Guitar"])
      .withNickname("johnny")
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
          nickname: null,
          avatar: null,
          phone: null,
          is_active: true,
          preferences: {
            favorite_genres: [],
            favorite_artists: [],
            favorite_instruments: [],
          },
        },
      },
      {
        send_data: {
          name: faker.name,
          email: faker.email,
          nickname: faker.nickname,
          avatar: faker.avatar,
          phone: faker.phone,
          favorite_genres: faker.favorite_genres,
          favorite_artists: faker.favorite_artists,
          favorite_instruments: faker.favorite_instruments,
          is_active: true,
        },
        expected: {
          name: faker.name,
          email: faker.email,
          nickname: faker.nickname,
          avatar: null,
          phone: faker.phone,
          is_active: true,
          preferences: {
            favorite_genres: faker.favorite_genres,
            favorite_artists: faker.favorite_artists,
            favorite_instruments: faker.favorite_instruments,
          },
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
          nickname: null,
          avatar: null,
          phone: null,
          is_active: false,
          preferences: {
            favorite_genres: [],
            favorite_artists: [],
            favorite_instruments: [],
          },
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
            "name should not be empty",
            "name must be a string",
            "email should not be empty",
            "email must be an email",
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
      FAVORITE_GENRES_NOT_ARRAY: {
        send_data: {
          name: "John",
          email: "john@example.com",
          favorite_genres: "Rock",
        },
        expected: {
          message: ["favorite_genres must be an array"],
          ...defaultExpected,
        },
      },
      IS_ACTIVE_NOT_BOOLEAN: {
        send_data: {
          name: "John",
          email: "john@example.com",
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
    const faker = Audience.fake().aAudience();
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
          message: ["email must be a valid email"],
          ...defaultExpected,
        },
      },
      PHONE_INVALID: {
        send_data: {
          phone: "invalid phone",
        },
        expected: {
          message: ["phone must be a valid phone format"],
          ...defaultExpected,
        },
      },
    };
  }
}

export class UpdateAudienceFixture {
  static keysInResponse = _keysInResponse;

  static arrangeForUpdate() {
    const faker = Audience.fake()
      .aAudience()
      .withName("Updated Name")
      .withNickname("updated")
      .withPhone("11888888888")
      .withFavoriteGenres(["Jazz"])
      .withFavoriteArtists(["Queen"])
      .withFavoriteInstruments(["Piano"]);

    return [
      {
        send_data: {
          name: faker.name,
          nickname: faker.nickname,
          phone: faker.phone,
          favorite_genres: faker.favorite_genres,
          favorite_artists: faker.favorite_artists,
          favorite_instruments: faker.favorite_instruments,
          is_active: false,
        },
        expected: {
          name: faker.name,
          nickname: faker.nickname,
          phone: faker.phone,
          is_active: false,
          preferences: {
            favorite_genres: faker.favorite_genres,
            favorite_artists: faker.favorite_artists,
            favorite_instruments: faker.favorite_instruments,
          },
        },
      },
      {
        send_data: {
          nickname: null,
          phone: null,
        },
        expected: {
          nickname: null,
          phone: null,
        },
      },
    ];
  }
}

export class ListAudiencesFixture {
  static arrangeIncrementedWithCreatedAt() {
    const base = new Date("2024-01-01T00:00:00.000Z").getTime();

    const _entities = Audience.fake()
      .theAudiences(4)
      .withName((i) => `name-${i}`)
      .withEmail((i) => `user-${i}@example.com`)
      .withCreatedAt((i) => new Date(base + i * 2000))
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
            entitiesMap.first,
            entitiesMap.second,
            entitiesMap.third,
            entitiesMap.fourth,
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
          entities: [entitiesMap.first, entitiesMap.second],
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
          entities: [entitiesMap.third, entitiesMap.fourth],
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
    const faker = Audience.fake().aAudience();

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
          sort_dir: "asc",
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
          sort_dir: "asc",
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
