import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import {
  InvalidUuidError,
  Uuid,
} from "../../../../../shared/domain/value-objects/uuid.vo";
import { Audience } from "../../../../domain/audience.aggregate";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { VoteSongInput } from "../vote-song.input";
import { VoteSongUseCase } from "../vote-song.use-case";

describe("VoteSongUseCase Unit Tests", () => {
  let useCase: VoteSongUseCase;
  let repository: AudienceInMemoryRepository;
  let voteRequestUseCase: { execute: jest.Mock };

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    voteRequestUseCase = { execute: jest.fn().mockResolvedValue({}) };
    useCase = new VoteSongUseCase(repository, voteRequestUseCase as any);
  });

  it("should throw error when audience not found", async () => {
    const audienceId = new Uuid();
    const input: VoteSongInput = {
      audience_id: audienceId.id,
      request_id: "request_123",
      vote: "up",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(audienceId.id, Audience),
    );
  });

  it("should throw error when audience_id is not valid", async () => {
    const input: VoteSongInput = {
      audience_id: "invalid-id",
      request_id: "request_123",
      vote: "down",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  it("should throw error when audience is not active", async () => {
    const audience = Audience.fake().aAudience().deactivate().build();
    await repository.insert(audience);

    const input: VoteSongInput = {
      audience_id: audience.audience_id.id,
      request_id: "request_123",
      vote: "up",
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

  describe("should vote for song", () => {
    const arrange = [
      {
        input: {
          request_id: "request_123",
          vote: "up",
        },
        expected: {
          points_added: 0,
        },
      },
      {
        input: {
          request_id: "request_456",
          vote: "down",
        },
        expected: {
          points_added: 0,
        },
      },
    ];

    test.each(arrange)("when input is $input", async ({ input, expected }) => {
      const audience = Audience.fake().aAudience().build();
      const initialPoints = audience.totalPoints;
      await repository.insert(audience);

      const fullInput: VoteSongInput = {
        audience_id: audience.audience_id.id,
        ...input,
      } as VoteSongInput;

      const output = await useCase.execute(fullInput);

      expect(output.id).toBe(audience.audience_id.id);
      expect(voteRequestUseCase.execute).toHaveBeenCalledTimes(1);
      expect(output.points.total).toBe(initialPoints + expected.points_added);
      expect(output.is_active).toBe(true);

      // Verificar se a audiência foi atualizada no repositório
      const updatedAudience = await repository.findById(audience.audience_id);
      expect(updatedAudience!.totalPoints).toBe(
        initialPoints + expected.points_added,
      );
    });
  });

  it("should vote for song and return correct output structure", async () => {
    const audience = Audience.fake()
      .aAudience()
      .withName("Test User")
      .withEmail("test@example.com")
      .build();
    await repository.insert(audience);

    const input: VoteSongInput = {
      audience_id: audience.audience_id.id,
      request_id: "request_123",
      vote: "up",
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
