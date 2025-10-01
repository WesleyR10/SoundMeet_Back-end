import { ScanQRUseCase } from "../scan-qr.use-case";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { Audience } from "../../../../domain/audience.aggregate";
import { ScanQRInput } from "../scan-qr.input";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import {
  InvalidUuidError,
  Uuid,
} from "../../../../../shared/domain/value-objects/uuid.vo";
import { Points } from "../../../../../shared/domain/value-objects/points.vo";

describe("ScanQRUseCase Unit Tests", () => {
  let useCase: ScanQRUseCase;
  let repository: AudienceInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    useCase = new ScanQRUseCase(repository);
  });

  it("should throw error when audience not found", async () => {
    const audienceId = new Uuid();
    const input: ScanQRInput = {
      id: audienceId.id,
      qr_code: "musician_123",
      musician_id: "musician_123",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(audienceId.id, Audience),
    );
  });

  it("should throw error when id is not valid", async () => {
    const input: ScanQRInput = {
      id: "invalid-id",
      qr_code: "musician_123",
      musician_id: "musician_123",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  describe("should scan QR code", () => {
    const arrange = [
      {
        input: {
          qr_code: "musician_123",
          musician_id: "musician_123",
        },
        expected: {
          points_earned: {
            value: 10,
            source: "scan_qr",
          },
          new_badges: ["iniciante"],
          scan_metadata: {
            musician_id: "musician_123",
            qr_code: "musician_123",
          },
        },
      },
      {
        input: {
          qr_code: "musician_456",
          musician_id: "musician_456",
          establishment_id: "establishment_789",
          event_id: "event_101",
          location: {
            latitude: -23.5505,
            longitude: -46.6333,
          },
          metadata: {
            device_info: "iPhone 12",
            app_version: "1.0.0",
          },
        },
        expected: {
          points_earned: {
            value: 10,
            source: "scan_qr",
          },
          new_badges: ["iniciante"],
          scan_metadata: {
            musician_id: "musician_456",
            qr_code: "musician_456",
            establishment_id: "establishment_789",
            event_id: "event_101",
          },
        },
      },
    ];

    test.each(arrange)("when input is $input", async ({ input, expected }) => {
      const audience = Audience.fake().withBadges([]).build();
      repository.items = [audience];
      const spyUpdate = jest.spyOn(repository, "update");

      const fullInput = {
        id: audience.id.id,
        ...input,
      };

      const output = await useCase.execute(fullInput);

      expect(spyUpdate).toHaveBeenCalledTimes(1);
      expect(output.audience.id).toBe(audience.id.id);
      expect(output.points_earned).toBeInstanceOf(Points);
      expect(output.points_earned.value).toBe(expected.points_earned.value);
      expect(output.points_earned.source).toBe(expected.points_earned.source);
      expect(output.new_badges).toEqual(expected.new_badges);
      expect(output.scan_metadata).toMatchObject(expected.scan_metadata);
      expect(output.scan_metadata.scanned_at).toBeInstanceOf(Date);

      // Verify audience was updated in repository
      const updatedAudience = await repository.findById(audience.id);
      expect(updatedAudience).toBeDefined();
      expect(updatedAudience!.totalPoints).toBe(expected.points_earned.value);
    });
  });

  it("should handle multiple QR scans and accumulate points", async () => {
    const audience = Audience.fake().build();
    repository.items = [audience];

    const input1: ScanQRInput = {
      id: audience.id.id,
      qr_code: "musician_123",
      musician_id: "musician_123",
    };

    const input2: ScanQRInput = {
      id: audience.id.id,
      qr_code: "musician_456",
      musician_id: "musician_456",
    };

    const output1 = await useCase.execute(input1);
    const output2 = await useCase.execute(input2);

    expect(output1.points_earned).toBeInstanceOf(Points);
    expect(output1.points_earned.value).toBe(10);
    expect(output2.points_earned).toBeInstanceOf(Points);
    expect(output2.points_earned.value).toBe(10);
    expect(output2.audience.points.total).toBe(20); // 10 points per scan

    // Verify both audiences were updated
    const updatedAudience = await repository.findById(audience.id);
    expect(updatedAudience).toBeDefined();
    expect(updatedAudience!.totalPoints).toBe(20); // Total accumulated points
  });

  it("should update level when points threshold is reached", async () => {
    const audience = Audience.fake().build();
    // Set initial points close to level threshold
    audience.addPoints(90); // Assuming level threshold is at 100 points
    repository.items = [audience];

    const input: ScanQRInput = {
      id: audience.id.id,
      qr_code: "musician_123",
      musician_id: "musician_123",
    };

    const output = await useCase.execute(input);

    expect(output.points_earned).toBeInstanceOf(Points);
    expect(output.points_earned.value).toBe(10);
    expect(output.new_level).toBeDefined();
    expect(output.audience.points.total).toBe(100); // 90 + 10 = 100
  });
});
