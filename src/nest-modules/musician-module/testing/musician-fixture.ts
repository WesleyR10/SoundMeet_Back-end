import { SortDirection } from "../../../core/shared/domain/repository/search-params";
import { Musician } from "../../../core/musician/domain/musician.aggregate";
import { MusicianSearchParams } from "../../../core/musician/domain/musician.repository";

export class CreateMusicianFixture {
  static arrangeForSave() {
    const faker = Musician.fake()
      .aMusician()
      .withName("John Doe")
      .withEmail("john@example.com")
      .withStageName("Johnny Rock")
      .withGenres(["Rock", "Blues"])
      .withInstruments(["Guitar", "Vocals"])
      .withBio("Experienced rock musician")
      .withPhoneNumber("+5511999999999")
      .withInstagramHandle("@johnnyrock")
      .withYoutubeChannel("JohnnyRockOfficial")
      .withSpotifyProfile("johnnyrock")
      .withIsActive(true)
      .withIsVerified(false);

    return [
      {
        send_data: {
          name: faker.name,
          email: faker.email,
          stage_name: faker.stage_name,
          genres: faker.genres,
          instruments: faker.instruments,
          bio: faker.bio,
          phone_number: faker.phone_number,
          instagram_handle: faker.instagram_handle,
          youtube_channel: faker.youtube_channel,
          spotify_profile: faker.spotify_profile,
          is_active: faker.is_active,
        },
        expected: {
          name: faker.name,
          email: faker.email,
          stage_name: faker.stage_name,
          genres: faker.genres,
          instruments: faker.instruments,
          bio: faker.bio,
          phone_number: faker.phone_number,
          instagram_handle: faker.instagram_handle,
          youtube_channel: faker.youtube_channel,
          spotify_profile: faker.spotify_profile,
          is_active: faker.is_active,
          is_verified: false,
        },
      },
    ];
  }

  static arrangeInvalidRequest() {
    const defaultExpected = {
      statusCode: 422,
      error: "Unprocessable Entity",
    };

    return [
      {
        label: "BODY_EMPTY",
        send_data: {},
        expected: {
          message: [
            "name should not be empty",
            "name must be a string",
            "email should not be empty",
            "email must be an email",
            "stage_name should not be empty",
            "stage_name must be a string",
            "genres should not be empty",
            "genres must be an array",
            "instruments should not be empty",
            "instruments must be an array",
          ],
          ...defaultExpected,
        },
      },
      {
        label: "NAME_UNDEFINED",
        send_data: {
          name: undefined,
          email: "test@example.com",
          stage_name: "Test Stage",
          genres: ["Rock"],
          instruments: ["Guitar"],
        },
        expected: {
          message: ["name should not be empty", "name must be a string"],
          ...defaultExpected,
        },
      },
      {
        label: "NAME_NULL",
        send_data: {
          name: null,
          email: "test@example.com",
          stage_name: "Test Stage",
          genres: ["Rock"],
          instruments: ["Guitar"],
        },
        expected: {
          message: ["name should not be empty", "name must be a string"],
          ...defaultExpected,
        },
      },
      {
        label: "NAME_EMPTY",
        send_data: {
          name: "",
          email: "test@example.com",
          stage_name: "Test Stage",
          genres: ["Rock"],
          instruments: ["Guitar"],
        },
        expected: {
          message: ["name should not be empty"],
          ...defaultExpected,
        },
      },
      {
        label: "EMAIL_INVALID",
        send_data: {
          name: "Test Name",
          email: "invalid-email",
          stage_name: "Test Stage",
          genres: ["Rock"],
          instruments: ["Guitar"],
        },
        expected: {
          message: ["email must be an email"],
          ...defaultExpected,
        },
      },
      {
        label: "GENRES_NOT_ARRAY",
        send_data: {
          name: "Test Name",
          email: "test@example.com",
          stage_name: "Test Stage",
          genres: "Rock",
          instruments: ["Guitar"],
        },
        expected: {
          message: ["genres must be an array"],
          ...defaultExpected,
        },
      },
      {
        label: "INSTRUMENTS_NOT_ARRAY",
        send_data: {
          name: "Test Name",
          email: "test@example.com",
          stage_name: "Test Stage",
          genres: ["Rock"],
          instruments: "Guitar",
        },
        expected: {
          message: ["instruments must be an array"],
          ...defaultExpected,
        },
      },
    ];
  }

  static arrangeForEntityValidationError() {
    const faker = Musician.fake().aMusician();
    const defaultExpected = {
      statusCode: 422,
      error: "Unprocessable Entity",
    };

    return [
      {
        label: "NAME_TOO_LONG",
        send_data: {
          name: "a".repeat(256),
          email: faker.email,
          stage_name: faker.stage_name,
          genres: faker.genres,
          instruments: faker.instruments,
        },
        expected: {
          message: ["name must be shorter than or equal to 255 characters"],
          ...defaultExpected,
        },
      },
      {
        label: "STAGE_NAME_TOO_LONG",
        send_data: {
          name: faker.name,
          email: faker.email,
          stage_name: "a".repeat(101),
          genres: faker.genres,
          instruments: faker.instruments,
        },
        expected: {
          message: [
            "stage_name must be shorter than or equal to 100 characters",
          ],
          ...defaultExpected,
        },
      },
    ];
  }
}

export class UpdateMusicianFixture {
  static arrangeForSave() {
    const faker = Musician.fake()
      .aMusician()
      .withName("Updated Name")
      .withStageName("Updated Stage")
      .withGenres(["Jazz", "Blues"])
      .withInstruments(["Piano", "Vocals"])
      .withBio("Updated bio")
      .withPhoneNumber("+5511888888888")
      .withInstagramHandle("@updatedmusician")
      .withYoutubeChannel("UpdatedChannel")
      .withSpotifyProfile("updatedprofile")
      .withIsActive(true);

    return [
      {
        send_data: {
          name: faker.name,
          stage_name: faker.stage_name,
          genres: faker.genres,
          instruments: faker.instruments,
          bio: faker.bio,
          phone_number: faker.phone_number,
          instagram_handle: faker.instagram_handle,
          youtube_channel: faker.youtube_channel,
          spotify_profile: faker.spotify_profile,
          is_active: faker.is_active,
        },
        expected: {
          name: faker.name,
          stage_name: faker.stage_name,
          genres: faker.genres,
          instruments: faker.instruments,
          bio: faker.bio,
          phone_number: faker.phone_number,
          instagram_handle: faker.instagram_handle,
          youtube_channel: faker.youtube_channel,
          spotify_profile: faker.spotify_profile,
          is_active: faker.is_active,
        },
      },
    ];
  }

  static arrangeInvalidRequest() {
    const defaultExpected = {
      statusCode: 422,
      error: "Unprocessable Entity",
    };

    return [
      {
        label: "NAME_TOO_LONG",
        send_data: {
          name: "a".repeat(256),
        },
        expected: {
          message: ["name must be shorter than or equal to 255 characters"],
          ...defaultExpected,
        },
      },
      {
        label: "GENRES_NOT_ARRAY",
        send_data: {
          genres: "Rock",
        },
        expected: {
          message: ["genres must be an array"],
          ...defaultExpected,
        },
      },
    ];
  }
}

export class ListMusiciansFixture {
  static arrangeIncrementedWithcreated_at() {
    const _entities = Musician.fake()
      .theMusicians(4)
      .withName((index) => `Musician ${index}`)
      .withStageName((index) => `Stage ${index}`)
      .withcreated_at((index) => new Date(new Date().getTime() + index * 1000))
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
    ];

    return { arrange, entitiesMap };
  }

  static arrangeUnsorted() {
    const faker = Musician.fake();
    const entitiesMap = {
      musician_a: faker.aMusician().withName("a").build(),
      musician_AAA: faker.aMusician().withName("AAA").build(),
      musician_AaA: faker.aMusician().withName("AaA").build(),
      musician_b: faker.aMusician().withName("b").build(),
      musician_c: faker.aMusician().withName("c").build(),
    };

    const arrange_filter_by_name_sort_name_asc = [
      {
        send_data: {
          page: 1,
          per_page: 2,
          sort: "name",
          sort_dir: "asc" as SortDirection,
          filter: "a",
        },
        expected: {
          entities: [entitiesMap.musician_AAA, entitiesMap.musician_AaA],
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
          sort_dir: "asc" as SortDirection,
          filter: "a",
        },
        expected: {
          entities: [entitiesMap.musician_a],
          meta: {
            total: 3,
            current_page: 2,
            last_page: 2,
            per_page: 2,
          },
        },
      },
    ];

    return { arrange_filter_by_name_sort_name_asc, entitiesMap };
  }
}
