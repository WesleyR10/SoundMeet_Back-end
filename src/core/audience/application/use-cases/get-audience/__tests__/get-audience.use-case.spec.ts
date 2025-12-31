import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Audience } from "../../../../domain/audience.aggregate";
import { AudienceFakeBuilder } from "../../../../domain/audience-fake.builder";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { GetAudienceUseCase } from "../get-audience.use-case";

describe("GetAudienceUseCase Unit Tests", () => {
  let useCase: GetAudienceUseCase;
  let repository: AudienceInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    useCase = new GetAudienceUseCase(repository);
  });

  it("should get an audience by id", async () => {
    const audience = Audience.fake().build();
    await repository.insert(audience);

    const output = await useCase.execute({ id: audience.id.id });

    expect(output).toStrictEqual({
      id: audience.id.id,
      name: audience.name,
      email: audience.emailValue,
      nickname: audience.nickname,
      avatar: audience.avatar,
      phone: audience.phoneValue,
      badges: audience.badges,
      favorite_genres: audience.favorite_genres,
      favorite_artists: audience.favorite_artists,
      favorite_instruments: audience.favorite_instruments,
      points: {
        total: audience.totalPoints,
        monthly: audience.monthlyPoints,
        last_updated: audience.points.lastUpdated,
      },
      level: {
        level: audience.currentLevel,
        name: audience.levelName,
        min_points: audience.level.minPoints,
        max_points: audience.level.maxPoints,
        benefits: audience.levelBenefits,
      },
      preferences: {
        favorite_genres: audience.favorite_genres,
        favorite_artists: audience.favorite_artists,
        favorite_instruments: audience.favorite_instruments,
        preferred_languages: audience.preferences.preferredLanguages,
        notification_settings: audience.preferences.notificationSettings,
        privacy_settings: audience.preferences.privacySettings,
        music_discovery_settings: audience.preferences.musicDiscoverySettings,
      },
      notification_settings: audience.preferences.notificationSettings,
      privacy_settings: audience.preferences.privacySettings,
      discovery_settings: audience.preferences.musicDiscoverySettings,
      is_active: audience.is_active,
      created_at: audience.created_at,
      updated_at: audience.updated_at,
      display_name: audience.displayName,
      current_level: audience.currentLevel,
      level_name: audience.levelName,
      points_to_next_level: audience.pointsToNextLevel,
      max_requests_per_event: audience.maxRequestsPerEvent,
      has_vip_access: audience.hasVipAccess,
      can_access_exclusive_content: audience.canAccessExclusiveContent,
      is_profile_complete: audience.isProfileComplete,
      is_highly_engaged: audience.isHighlyEngaged,
      is_new_user: audience.isNewUser,
    });
  });

  it("should throw error when audience not found", async () => {
    const nonExistentId = "550e8400-e29b-41d4-a716-446655440000";

    await expect(useCase.execute({ id: nonExistentId })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("should throw error when id is invalid", async () => {
    const invalidId = "invalid-uuid";

    await expect(useCase.execute({ id: invalidId })).rejects.toThrow(
      "ID must be a valida UUID",
    );
  });

  it("should get inactive audience", async () => {
    const audience = AudienceFakeBuilder.aAudience().deactivate().build();
    await repository.insert(audience);

    const output = await useCase.execute({ id: audience.id.id });

    expect(output.is_active).toBe(false);
    expect(output.id).toBe(audience.id.id);
  });

  it("should get audience without phone and nickname", async () => {
    const audience = AudienceFakeBuilder.aAudience()
      .withNickname(null)
      .withPhone(null)
      .build();
    await repository.insert(audience);

    const output = await useCase.execute({ id: audience.id.id });

    expect(output.nickname).toBeNull();
    expect(output.phone).toBeNull();
    expect(output.id).toBe(audience.id.id);
  });

  it("should get audience with points and scans", async () => {
    const audience = AudienceFakeBuilder.aAudience()
      .withTotalPoints(500)
      .build();
    await repository.insert(audience);

    const output = await useCase.execute({ id: audience.id.id });

    expect(output.points.total).toBe(500);
    expect(output.id).toBe(audience.id.id);
  });
});
