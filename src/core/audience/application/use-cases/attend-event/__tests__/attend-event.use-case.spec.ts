import { AttendEventUseCase } from "../attend-event.use-case";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { Audience } from "../../../../domain/audience.aggregate";
import { AttendEventInput } from "../attend-event.input";
import { InvalidUuidError, Uuid } from "@core/shared/domain";
import { NotFoundError } from "@core/shared/domain/errors";

describe("AttendEventUseCase Unit Tests", () => {
  let useCase: AttendEventUseCase;
  let repository: AudienceInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    useCase = new AttendEventUseCase(repository);
  });

  it("should throw error when audience not found", async () => {
    const audienceId = new Uuid();
    const input: AttendEventInput = {
      audience_id: audienceId.id,
      event_id: "event_123",
      establishment_id: "establishment_123",
      event_date: new Date("2024-12-31T20:00:00Z"),
      notes: "Looking forward to this event!",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(audienceId.id, Audience),
    );
  });

  it("should throw error when audience_id is not valid", async () => {
    const input: AttendEventInput = {
      audience_id: "invalid-id",
      event_id: "event_123",
      establishment_id: "establishment_123",
      event_date: new Date("2024-12-31T20:00:00Z"),
      notes: "Looking forward to this event!",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  it("should throw error when audience is not active", async () => {
    const audience = Audience.fake().deactivate().build();
    await repository.insert(audience);

    const input: AttendEventInput = {
      audience_id: audience.id.id,
      event_id: "event_123",
      establishment_id: "establishment_123",
      event_date: new Date("2024-12-31T20:00:00Z"),
      notes: "Looking forward to this event!",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      "Audience is not active",
    );
  });

  describe("should attend event", () => {
    const arrange = [
      {
        input: {
          event_id: "event_123",
          establishment_id: "establishment_123",
          event_date: new Date("2024-12-31T20:00:00Z"),
          notes: "Looking forward to this event!",
        },
        expected: {
          points_added: 30,
        },
      },
      {
        input: {
          event_id: "event_456",
          establishment_id: "establishment_456",
          event_date: new Date("2024-12-25T19:30:00Z"),
          notes: "Christmas special event!",
        },
        expected: {
          points_added: 30,
        },
      },
      {
        input: {
          event_id: "event_789",
          establishment_id: "establishment_789",
          event_date: new Date("2024-11-15T21:00:00Z"),
          notes: "Jazz night event",
        },
        expected: {
          points_added: 30,
        },
      },
    ];

    test.each(arrange)("when input is $input", async ({ input, expected }) => {
      const audience = Audience.fake().build();
      const initialPoints = audience.totalPoints;
      await repository.insert(audience);

      const fullInput: AttendEventInput = {
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

  it("should attend event without notes", async () => {
    const audience = Audience.fake().build();
    const initialPoints = audience.totalPoints;
    await repository.insert(audience);

    const input: AttendEventInput = {
      audience_id: audience.id.id,
      event_id: "event_123",
      establishment_id: "establishment_123",
      event_date: new Date("2024-12-31T20:00:00Z"),
    };

    const output = await useCase.execute(input);

    expect(output.id).toBe(audience.id.id);
    expect(output.points.total).toBe(initialPoints + 30);
    expect(output.is_active).toBe(true);
  });

  it("should attend event and return correct output structure", async () => {
    const audience = Audience.fake()
      .withName("Test User")
      .withEmail("test@example.com")
      .build();
    await repository.insert(audience);

    const input: AttendEventInput = {
      audience_id: audience.id.id,
      event_id: "event_123",
      establishment_id: "establishment_123",
      event_date: new Date("2024-12-31T20:00:00Z"),
      notes: "Looking forward to this event!",
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

  it("should handle past event dates", async () => {
    const audience = Audience.fake().build();
    await repository.insert(audience);

    const pastDate = new Date("2023-01-01T20:00:00Z");
    const input: AttendEventInput = {
      audience_id: audience.id.id,
      event_id: "event_past",
      establishment_id: "establishment_123",
      event_date: pastDate,
      notes: "Past event attendance",
    };

    const output = await useCase.execute(input);

    expect(output.id).toBe(audience.id.id);
    expect(output.points.total).toBe(30); // Valor esperado baseado no fake builder
    expect(output.is_active).toBe(true);
  });
});
