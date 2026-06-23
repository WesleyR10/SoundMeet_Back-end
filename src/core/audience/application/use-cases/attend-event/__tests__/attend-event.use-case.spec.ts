import { InvalidUuidError, Uuid } from "@core/shared/domain";
import { NotFoundError } from "@core/shared/domain/errors";
import { EntityValidationError } from "@core/shared/domain/validators/validation.error";

import { Audience } from "../../../../domain/audience.aggregate";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { AttendEventInput } from "../attend-event.input";
import { AttendEventUseCase } from "../attend-event.use-case";

describe("AttendEventUseCase Unit Tests", () => {
  let useCase: AttendEventUseCase;
  let repository: AudienceInMemoryRepository;
  let addEventAttendeeUseCase: { execute: jest.Mock };

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    addEventAttendeeUseCase = { execute: jest.fn().mockResolvedValue({}) };
    useCase = new AttendEventUseCase(
      repository,
      addEventAttendeeUseCase as any,
    );
  });

  it("should throw error when audience not found", async () => {
    const audienceId = new Uuid();
    const input: AttendEventInput = {
      audience_id: audienceId.id,
      event_id: "550e8400-e29b-41d4-a716-446655440000",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(audienceId.id, Audience),
    );
  });

  it("should throw error when audience_id is not valid", async () => {
    const input: AttendEventInput = {
      audience_id: "invalid-id",
      event_id: "550e8400-e29b-41d4-a716-446655440000",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  it("should throw error when audience is not active", async () => {
    const audience = Audience.fake().aAudience().deactivate().build();
    await repository.insert(audience);

    const input: AttendEventInput = {
      audience_id: audience.audience_id.id,
      event_id: "550e8400-e29b-41d4-a716-446655440000",
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

  describe("should attend event", () => {
    const arrange = [
      {
        input: {
          event_id: "550e8400-e29b-41d4-a716-446655440000",
          establishment_id: new Uuid().id,
        },
        expected: {
          points_added: 0,
        },
      },
      {
        input: {
          event_id: "550e8400-e29b-41d4-a716-446655440001",
          establishment_id: new Uuid().id,
        },
        expected: {
          points_added: 0,
        },
      },
      {
        input: {
          event_id: "550e8400-e29b-41d4-a716-446655440002",
          establishment_id: new Uuid().id,
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

      const fullInput: AttendEventInput = {
        audience_id: audience.audience_id.id,
        ...input,
      };

      const output = await useCase.execute(fullInput);

      expect(output.id).toBe(audience.audience_id.id);
      expect(addEventAttendeeUseCase.execute).toHaveBeenCalledTimes(1);
      expect(output.points.total).toBe(initialPoints + expected.points_added);
      expect(output.is_active).toBe(true);

      // Verificar se a audiência foi atualizada no repositório
      const updatedAudience = await repository.findById(audience.audience_id);
      expect(updatedAudience!.totalPoints).toBe(
        initialPoints + expected.points_added,
      );
    });
  });

  it("should attend event without notes", async () => {
    const audience = Audience.fake().aAudience().build();
    const initialPoints = audience.totalPoints;
    await repository.insert(audience);

    const input: AttendEventInput = {
      audience_id: audience.audience_id.id,
      event_id: "550e8400-e29b-41d4-a716-446655440000",
      establishment_id: new Uuid().id,
    };

    const output = await useCase.execute(input);

    expect(output.id).toBe(audience.audience_id.id);
    expect(output.points.total).toBe(initialPoints);
    expect(output.is_active).toBe(true);
  });

  it("should attend event and return correct output structure", async () => {
    const audience = Audience.fake()
      .aAudience()
      .withName("Test User")
      .withEmail("test@example.com")
      .build();
    await repository.insert(audience);

    const input: AttendEventInput = {
      audience_id: audience.audience_id.id,
      event_id: "550e8400-e29b-41d4-a716-446655440000",
      establishment_id: new Uuid().id,
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

  it("should handle past event dates", async () => {
    const audience = Audience.fake().aAudience().build();
    await repository.insert(audience);

    const input: AttendEventInput = {
      audience_id: audience.audience_id.id,
      event_id: "550e8400-e29b-41d4-a716-446655440000",
      establishment_id: new Uuid().id,
    };

    const output = await useCase.execute(input);

    expect(output.id).toBe(audience.audience_id.id);
    expect(output.points.total).toBe(audience.totalPoints);
    expect(output.is_active).toBe(true);
  });
});
