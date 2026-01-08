import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import {
  InvalidUuidError,
  Uuid,
} from "../../../../../shared/domain/value-objects/uuid.vo";
import { Audience } from "../../../../domain/audience.aggregate";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { IndicateMusicianInput } from "../indicate-musician.input";
import { IndicateMusicianUseCase } from "../indicate-musician.use-case";

describe("IndicateMusicianUseCase Unit Tests", () => {
  let useCase: IndicateMusicianUseCase;
  let repository: AudienceInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    useCase = new IndicateMusicianUseCase(repository);
  });

  it("should throw error when audience not found", async () => {
    const audienceId = new Uuid();
    const input: IndicateMusicianInput = {
      audience_id: audienceId.id,
      musician_id: "musician_123",
      establishment_id: "establishment_123",
      message: "This musician is amazing!",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(audienceId.id, Audience),
    );
  });

  it("should throw error when audience_id is not valid", async () => {
    const input: IndicateMusicianInput = {
      audience_id: "invalid-id",
      musician_id: "musician_123",
      establishment_id: "establishment_123",
      message: "This musician is amazing!",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  it("should throw error when audience is not active", async () => {
    const audience = Audience.fake().aAudience().deactivate().build();
    await repository.insert(audience);

    const input: IndicateMusicianInput = {
      audience_id: audience.audience_id.id,
      musician_id: "musician_123",
      establishment_id: "establishment_123",
      message: "This musician is amazing!",
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

  describe("should indicate musician", () => {
    const arrange = [
      {
        input: {
          musician_id: "musician_123",
          establishment_id: "establishment_123",
          message: "This musician is amazing!",
        },
        expected: {
          points_added: 3,
        },
      },
      {
        input: {
          musician_id: "musician_456",
          establishment_id: "establishment_456",
          message: "Great performance, highly recommended!",
        },
        expected: {
          points_added: 3,
        },
      },
      {
        input: {
          musician_id: "musician_789",
          establishment_id: "establishment_789",
          message: "Excellent musician for this venue!",
        },
        expected: {
          points_added: 3,
        },
      },
    ];

    test.each(arrange)("when input is $input", async ({ input, expected }) => {
      const audience = Audience.fake().aAudience().build();
      const initialPoints = audience.totalPoints;
      await repository.insert(audience);

      const fullInput: IndicateMusicianInput = {
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

  it("should indicate musician without message", async () => {
    const audience = Audience.fake().aAudience().build();
    const initialPoints = audience.totalPoints;
    await repository.insert(audience);

    const input: IndicateMusicianInput = {
      audience_id: audience.audience_id.id,
      musician_id: "musician_123",
      establishment_id: "establishment_123",
    };

    const output = await useCase.execute(input);

    expect(output.id).toBe(audience.audience_id.id);
    expect(output.points.total).toBe(initialPoints + 3);
    expect(output.is_active).toBe(true);
  });

  it("should indicate musician and return correct output structure", async () => {
    const audience = Audience.fake()
      .aAudience()
      .withName("Test User")
      .withEmail("test@example.com")
      .build();
    await repository.insert(audience);

    const input: IndicateMusicianInput = {
      audience_id: audience.audience_id.id,
      musician_id: "musician_123",
      establishment_id: "establishment_123",
      message: "This musician is amazing!",
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
