import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import {
  InvalidUuidError,
  Uuid,
} from "../../../../../shared/domain/value-objects/uuid.vo";
import { Audience } from "../../../../domain/audience.aggregate";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { CompleteProfileInput } from "../complete-profile.input";
import { CompleteProfileUseCase } from "../complete-profile.use-case";

describe("CompleteProfileUseCase Unit Tests", () => {
  let useCase: CompleteProfileUseCase;
  let repository: AudienceInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    useCase = new CompleteProfileUseCase(repository);
  });

  it("should throw error when audience not found", async () => {
    const audienceId = new Uuid();
    const input: CompleteProfileInput = {
      audience_id: audienceId.id,
      name: "John Doe",
      nickname: "Johnny",
      avatar: "https://example.com/avatar.jpg",
      phone: "+5511999999999",
      favorite_genres: ["Rock", "Pop"],
      favorite_artists: ["The Beatles", "Queen"],
      notification_settings: {
        email_notifications: true,
        push_notifications: true,
        sms_notifications: false,
      },
      privacy_settings: {
        profile_visibility: "public",
        show_activity: true,
        show_favorites: true,
      } as any,
      discovery_settings: {
        discoverable_by_email: true,
        discoverable_by_phone: true,
        show_in_suggestions: true,
        location_based_suggestions: false,
      },
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(audienceId.id, Audience),
    );
  });

  it("should throw error when audience_id is not valid", async () => {
    const input: CompleteProfileInput = {
      audience_id: "invalid-id",
      name: "John Doe",
      nickname: "Johnny",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  it("should throw error when audience is not active", async () => {
    const audience = Audience.fake().aAudience().deactivate().build();
    await repository.insert(audience);

    const input: CompleteProfileInput = {
      audience_id: audience.audience_id.id,
      name: "John Doe",
      nickname: "Johnny",
    };

    await expect(useCase.execute(input)).rejects.toThrow(EntityValidationError);
    await expect(useCase.execute(input)).rejects.toMatchObject({
      error: expect.arrayContaining([
        expect.objectContaining({
          is_active: expect.arrayContaining(["Audience is not active"]),
        }),
      ]),
    });
  });

  describe("should complete profile", () => {
    const arrange = [
      {
        input: {
          name: "John Doe",
          nickname: "Johnny",
          avatar: "https://example.com/avatar.jpg",
          phone: "+5511999999999",
          favorite_genres: ["Rock", "Pop"],
          favorite_artists: ["The Beatles", "Queen"],
        },
        expected: {
          points_added: 10,
        },
      },
      {
        input: {
          name: "Jane Smith",
          nickname: "Janie",
          favorite_genres: ["Jazz", "Blues"],
          favorite_artists: ["Miles Davis", "B.B. King"],
          notification_settings: {
            email_notifications: true,
            push_notifications: false,
            sms_notifications: true,
          },
        },
        expected: {
          points_added: 10,
        },
      },
      {
        input: {
          name: "Bob Wilson",
          nickname: "Bobby",
          privacy_settings: {
            profile_visibility: "private",
            show_activity: false,
            show_favorites: true,
          } as any,
          discovery_settings: {
            discoverable_by_email: false,
            discoverable_by_phone: false,
            show_in_suggestions: false,
            location_based_suggestions: true,
          },
        },
        expected: {
          points_added: 10,
        },
      },
    ];

    test.each(arrange)("when input is $input", async ({ input, expected }) => {
      const audience = Audience.fake().aAudience().build();
      const initialPoints = audience.totalPoints;
      await repository.insert(audience);

      const fullInput: CompleteProfileInput = {
        audience_id: audience.audience_id.id,
        ...input,
      };

      const output = await useCase.execute(fullInput);

      expect(output.id).toBe(audience.audience_id.id);
      expect(output.points.total).toBe(initialPoints + expected.points_added);
      expect(output.is_active).toBe(true);

      // Verificar se os dados foram atualizados
      if (input.name) expect(output.name).toBe(input.name);
      if (input.nickname) expect(output.nickname).toBe(input.nickname);
      if (input.avatar) expect(output.avatar).toBe(input.avatar);
      if (input.phone) expect(output.phone).toBe(input.phone);
      if (input.favorite_genres) {
        expect(output.preferences.favorite_genres).toEqual(
          input.favorite_genres,
        );
      }
      if (input.favorite_artists) {
        expect(output.preferences.favorite_artists).toEqual(
          input.favorite_artists,
        );
      }

      // Verificar se a audiência foi atualizada no repositório
      const updatedAudience = await repository.findById(audience.audience_id);
      expect(updatedAudience!.totalPoints).toBe(
        initialPoints + expected.points_added,
      );
    });
  });

  it("should complete profile with minimal data", async () => {
    const audience = Audience.fake().aAudience().build();
    const initialPoints = audience.totalPoints;
    await repository.insert(audience);

    const input: CompleteProfileInput = {
      audience_id: audience.audience_id.id,
      name: "Minimal User",
    };

    const output = await useCase.execute(input);

    expect(output.id).toBe(audience.audience_id.id);
    expect(output.name).toBe("Minimal User");
    expect(output.points.total).toBe(initialPoints + 10);
    expect(output.is_active).toBe(true);
  });

  it("should complete profile and return correct output structure", async () => {
    const audience = Audience.fake()
      .aAudience()
      .withName("Original Name")
      .withEmail("test@example.com")
      .build();
    await repository.insert(audience);

    const input: CompleteProfileInput = {
      audience_id: audience.audience_id.id,
      name: "Updated Name",
      nickname: "UpdatedNick",
      avatar: "https://example.com/new-avatar.jpg",
      phone: "+5511888888888",
      favorite_genres: ["Electronic", "House"],
      favorite_artists: ["Daft Punk", "Deadmau5"],
      notification_settings: {
        email_notifications: true,
        push_notifications: true,
        sms_notifications: false,
      },
      privacy_settings: {
        profile_visibility: "public",
        show_activity: true,
        show_favorites: true,
      } as any,
      discovery_settings: {
        discoverable_by_email: true,
        discoverable_by_phone: true,
        show_in_suggestions: true,
        location_based_suggestions: false,
      },
    };

    const output = await useCase.execute(input);

    expect(output).toMatchObject({
      id: audience.audience_id.id,
      name: "Updated Name",
      email: "test@example.com",
      nickname: "UpdatedNick",
      avatar: "https://example.com/new-avatar.jpg",
      phone: "+5511888888888",
      is_active: true,
      preferences: {
        favorite_genres: ["Electronic", "House"],
        favorite_artists: ["Daft Punk", "Deadmau5"],
      },
      points: {
        total: expect.any(Number),
        monthly: expect.any(Number),
        last_updated: expect.any(Date),
      },
      level: {
        level: expect.any(Number),
        name: expect.any(String),
        min_points: expect.any(Number),
        max_points: expect.any(Number),
      },
    });
  });

  it("should handle empty arrays for preferences", async () => {
    const audience = Audience.fake().aAudience().build();
    await repository.insert(audience);

    const input: CompleteProfileInput = {
      audience_id: audience.audience_id.id,
      name: "Test User",
      favorite_genres: [],
      favorite_artists: [],
    };

    const output = await useCase.execute(input);

    expect(output.preferences.favorite_genres).toEqual([]);
    expect(output.preferences.favorite_artists).toEqual([]);
  });
});
