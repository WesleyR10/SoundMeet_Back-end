import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import {
  InvalidUuidError,
  Uuid,
} from "../../../../../shared/domain/value-objects/uuid.vo";
import { Audience } from "../../../../domain/audience.aggregate";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import {
  ShareSocialMediaInput,
  SocialMediaPlatform,
} from "../share-social-media.input";
import { ShareSocialMediaUseCase } from "../share-social-media.use-case";

describe("ShareSocialMediaUseCase Unit Tests", () => {
  let useCase: ShareSocialMediaUseCase;
  let repository: AudienceInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    useCase = new ShareSocialMediaUseCase(repository);
  });

  it("should throw error when audience not found", async () => {
    const audienceId = new Uuid();
    const input: ShareSocialMediaInput = {
      audience_id: audienceId.id,
      request_id: "request_123",
      platform: SocialMediaPlatform.INSTAGRAM,
      message: "Check out this amazing song!",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(audienceId.id, Audience),
    );
  });

  it("should throw error when audience_id is not valid", async () => {
    const input: ShareSocialMediaInput = {
      audience_id: "invalid-id",
      request_id: "request_123",
      platform: SocialMediaPlatform.INSTAGRAM,
      message: "Check out this amazing song!",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  it("should throw error when audience is not active", async () => {
    const audience = Audience.fake().aAudience().deactivate().build();
    await repository.insert(audience);

    const input: ShareSocialMediaInput = {
      audience_id: audience.audience_id.id,
      request_id: "request_123",
      platform: SocialMediaPlatform.INSTAGRAM,
      message: "Check out this amazing song!",
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

  describe("should share on social media", () => {
    const arrange = [
      {
        input: {
          request_id: "request_123",
          platform: SocialMediaPlatform.INSTAGRAM,
          message: "Check out this amazing song!",
        },
        expected: {
          points_added: 50,
        },
      },
      {
        input: {
          request_id: "request_456",
          platform: SocialMediaPlatform.FACEBOOK,
          message: "Great music here!",
        },
        expected: {
          points_added: 50,
        },
      },
      {
        input: {
          request_id: "request_789",
          platform: SocialMediaPlatform.TWITTER,
          message: "Amazing performance! 🎵",
        },
        expected: {
          points_added: 50,
        },
      },
      {
        input: {
          request_id: "request_101",
          platform: SocialMediaPlatform.WHATSAPP,
          message: "You should listen to this!",
        },
        expected: {
          points_added: 50,
        },
      },
    ];

    test.each(arrange)("when input is $input", async ({ input, expected }) => {
      const audience = Audience.fake().aAudience().build();
      const initialPoints = audience.totalPoints;
      await repository.insert(audience);

      const fullInput: ShareSocialMediaInput = {
        audience_id: audience.audience_id.id,
        ...input,
      };

      const output = await useCase.execute(fullInput);

      expect(output.id).toBe(audience.audience_id.id);
      expect(output.points.total).toBe(initialPoints + expected.points_added);
      expect(output.is_active).toBe(true);

      // Verificar se a audiência foi atualizada no repositório
      const updatedAudience = await repository.findById(audience.audience_id);
      expect(updatedAudience!.totalPoints).toBe(
        initialPoints + expected.points_added,
      );
    });
  });

  it("should share on social media and return correct output structure", async () => {
    const audience = Audience.fake()
      .aAudience()
      .withName("Test User")
      .withEmail("test@example.com")
      .build();
    await repository.insert(audience);

    const input: ShareSocialMediaInput = {
      audience_id: audience.audience_id.id,
      request_id: "request_123",
      platform: SocialMediaPlatform.INSTAGRAM,
      message: "Check out this amazing song!",
    };

    const output = await useCase.execute(input);

    expect(output).toMatchObject({
      id: audience.audience_id.id,
      name: "Test User",
      email: "test@example.com",
      is_active: true,
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
});
