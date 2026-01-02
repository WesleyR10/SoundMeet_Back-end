import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import {
  InvalidUuidError,
  Uuid,
} from "../../../../../shared/domain/value-objects/uuid.vo";
import { Audience } from "../../../../domain/audience.aggregate";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { MakeMusicRequestInput } from "../make-music-request.input";
import { MakeMusicRequestUseCase } from "../make-music-request.use-case";

describe("MakeMusicRequestUseCase Unit Tests", () => {
  let useCase: MakeMusicRequestUseCase;
  let repository: AudienceInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    useCase = new MakeMusicRequestUseCase(repository);
  });

  it("should throw error when audience not found", async () => {
    const audienceId = new Uuid();
    const input: MakeMusicRequestInput = {
      id: audienceId.id,
      musician_id: "musician-id",
      song_title: "Test Song",
      artist_name: "Test Artist",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(audienceId.id, Audience),
    );
  });

  it("should throw error when id is not valid", async () => {
    const input: MakeMusicRequestInput = {
      id: "invalid-id",
      musician_id: "musician-id",
      song_title: "Test Song",
      artist_name: "Test Artist",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  describe("should make a music request", () => {
    const arrange = [
      {
        input: {
          musician_id: "musician-123",
          song_title: "Bohemian Rhapsody",
          artist_name: "Queen",
        },
        expected: {
          points_earned: 25,
          new_badges: [],
          request_metadata: {
            musician_id: "musician-123",
            song_title: "Bohemian Rhapsody",
            artist_name: "Queen",
            status: "pending",
          },
        },
      },
      {
        input: {
          musician_id: "musician-456",
          song_title: "Hotel California",
          artist_name: "Eagles",
          genre: "Rock",
          difficulty: "intermediate",
          message: "Please play this one!",
        },
        expected: {
          points_earned: 25,
          new_badges: [],
          request_metadata: {
            musician_id: "musician-456",
            song_title: "Hotel California",
            artist_name: "Eagles",
            genre: "Rock",
            difficulty: "intermediate",
            message: "Please play this one!",
            status: "pending",
          },
        },
      },
    ];

    test.each(arrange)("when input is $input", async ({ input, expected }) => {
      const audience = Audience.fake().aAudience().build();
      repository.items = [audience];
      const spyUpdate = jest.spyOn(repository, "update");

      const fullInput = {
        id: audience.id.id,
        ...input,
      };

      const output = await useCase.execute(fullInput);

      expect(spyUpdate).toHaveBeenCalledTimes(1);
      expect(output.audience.id).toBe(audience.id.id);
      expect(output.points_earned).toBe(expected.points_earned);
      expect(output.new_badges).toEqual(expected.new_badges);
      expect(output.request_metadata).toMatchObject(expected.request_metadata);
      expect(output.request_metadata.requested_at).toBeInstanceOf(Date);

      // Verify audience was updated in repository
      const updatedAudience = await repository.findById(audience.id);
      expect(updatedAudience).toBeDefined();
      expect(updatedAudience!.totalPoints).toBe(expected.points_earned);
    });
  });

  it("should handle multiple music requests and accumulate points", async () => {
    const audience = Audience.fake().aAudience().build();
    repository.items = [audience];

    const input1: MakeMusicRequestInput = {
      id: audience.id.id,
      musician_id: "musician-id-1",
      song_title: "Song 1",
      artist_name: "Artist 1",
    };

    const input2: MakeMusicRequestInput = {
      id: audience.id.id,
      musician_id: "musician-id-2",
      song_title: "Song 2",
      artist_name: "Artist 2",
    };

    const output1 = await useCase.execute(input1);
    const output2 = await useCase.execute(input2);

    expect(output1.points_earned).toBe(25);
    expect(output2.points_earned).toBe(25);
    expect(output2.audience.points.total).toBe(50); // 25 points per request

    // Verify final state in repository
    const finalAudience = await repository.findById(audience.id);
    expect(finalAudience!.totalPoints).toBe(50);
  });

  it("should handle request with all optional fields", async () => {
    const audience = Audience.fake().aAudience().build();
    repository.items = [audience];

    const input: MakeMusicRequestInput = {
      id: audience.id.id,
      musician_id: "musician-123",
      song_title: "Stairway to Heaven",
      artist_name: "Led Zeppelin",
      genre: "Rock",
      difficulty: "advanced",
      message: "This is my favorite song!",
      event_id: "event-456",
      establishment_id: "establishment-789",
    };

    const output = await useCase.execute(input);

    expect(output.request_metadata.genre).toBe("Rock");
    expect(output.request_metadata.difficulty).toBe("advanced");
    expect(output.request_metadata.message).toBe("This is my favorite song!");
    expect(output.request_metadata.event_id).toBe("event-456");
    expect(output.request_metadata.establishment_id).toBe("establishment-789");
  });
});
