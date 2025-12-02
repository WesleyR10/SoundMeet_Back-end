import { VoteSongUseCase } from "../vote-song.use-case";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { Audience } from "../../../../domain/audience.aggregate";
import { VoteSongInput } from "../vote-song.input";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import {
  InvalidUuidError,
  Uuid,
} from "../../../../../shared/domain/value-objects/uuid.vo";

describe("VoteSongUseCase Unit Tests", () => {
  let useCase: VoteSongUseCase;
  let repository: AudienceInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    useCase = new VoteSongUseCase(repository);
  });

  it("should throw error when audience not found", async () => {
    const audienceId = new Uuid();
    const input: VoteSongInput = {
      audience_id: audienceId.id,
      song_id: "song_123",
      request_id: "request_123",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(audienceId.id, Audience),
    );
  });

  it("should throw error when audience_id is not valid", async () => {
    const input: VoteSongInput = {
      audience_id: "invalid-id",
      song_id: "song_123",
      request_id: "request_123",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  it("should throw error when audience is not active", async () => {
    const audience = Audience.fake().deactivate().build();
    await repository.insert(audience);

    const input: VoteSongInput = {
      audience_id: audience.id.id,
      song_id: "song_123",
      request_id: "request_123",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      "Audience is not active",
    );
  });

  describe("should vote for song", () => {
    const arrange = [
      {
        input: {
          song_id: "song_123",
          request_id: "request_123",
        },
        expected: {
          points_added: 1,
        },
      },
      {
        input: {
          song_id: "song_456",
          request_id: "request_456",
        },
        expected: {
          points_added: 1,
        },
      },
    ];

    test.each(arrange)("when input is $input", async ({ input, expected }) => {
      const audience = Audience.fake().build();
      const initialPoints = audience.totalPoints;
      await repository.insert(audience);

      const fullInput: VoteSongInput = {
        audience_id: audience.id.id,
        ...input,
      };

      const output = await useCase.execute(fullInput);

      expect(output.id).toBe(audience.id.id);
      expect(output.points.total).toBe(initialPoints + expected.points_added);
      expect(output.is_active).toBe(true);

      // Verificar se a audiência foi atualizada no repositório
      const updatedAudience = await repository.findById(audience.id);
      expect(updatedAudience!.totalPoints).toBe(
        initialPoints + expected.points_added,
      );
    });
  });

  it("should vote for song and return correct output structure", async () => {
    const audience = Audience.fake()
      .withName("Test User")
      .withEmail("test@example.com")
      .build();
    await repository.insert(audience);

    const input: VoteSongInput = {
      audience_id: audience.id.id,
      song_id: "song_123",
      request_id: "request_123",
    };

    const output = await useCase.execute(input);

    expect(output).toMatchObject({
      id: audience.id.id,
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
