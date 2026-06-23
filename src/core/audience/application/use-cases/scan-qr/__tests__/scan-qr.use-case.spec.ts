import { UserInteraction } from "../../../../../gamification/domain/user-interaction.aggregate";
import { UserInteractionInMemoryRepository } from "../../../../../gamification/infra/db/in-memory/user-interaction-in-memory.repository";
import { Musician } from "../../../../../musician/domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../../musician/infra/db/in-memory/musician-in-memory.repository";
import { InvalidArgumentError } from "../../../../../shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Points } from "../../../../../shared/domain/value-objects/points.vo";
import {
  InvalidUuidError,
  Uuid,
} from "../../../../../shared/domain/value-objects/uuid.vo";
import { Audience } from "../../../../domain/audience.aggregate";
import { AudienceFakeBuilder } from "../../../../domain/audience-fake.builder";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { ScanQRInput } from "../scan-qr.input";
import { ScanQRUseCase } from "../scan-qr.use-case";

describe("ScanQRUseCase Unit Tests", () => {
  let useCase: ScanQRUseCase;
  let repository: AudienceInMemoryRepository;
  let userInteractionRepo: UserInteractionInMemoryRepository;
  let musicianRepository: MusicianInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    userInteractionRepo = new UserInteractionInMemoryRepository();
    musicianRepository = new MusicianInMemoryRepository();
    const uowMock = { do: async (fn: () => Promise<unknown>) => fn() } as any;
    useCase = new ScanQRUseCase(
      repository,
      userInteractionRepo,
      musicianRepository,
      uowMock,
    );
  });

  it("should throw error when audience not found", async () => {
    const audienceId = new Uuid();
    const input: ScanQRInput = {
      id: audienceId.id,
      qr_code: `soundmeet://musician/${new Uuid().id}`,
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(audienceId.id, Audience),
    );
  });

  it("should throw NotFoundError when musician does not exist", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    repository.items = [audience];
    const nonExistentMusicianId = new Uuid();

    await expect(() =>
      useCase.execute({
        id: audience.audience_id.id,
        qr_code: `soundmeet://musician/${nonExistentMusicianId.id}`,
      }),
    ).rejects.toThrow(new NotFoundError(nonExistentMusicianId.id, Musician));
  });

  it("should throw error when id is not valid", async () => {
    const input: ScanQRInput = {
      id: "invalid-id",
      qr_code: `soundmeet://musician/${new Uuid().id}`,
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  describe("should scan QR code", () => {
    const arrange = [
      {
        input: {
          qr_code: "dynamic",
        },
        expected: {
          points_earned: {
            value: 10,
            source: "scan_qr",
          },
          new_badges: ["iniciante"],
          scan_metadata: {
            qr_code: "dynamic",
          },
        },
      },
      {
        input: {
          qr_code: "dynamic",
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
            qr_code: "dynamic",
            establishment_id: "establishment_789",
            event_id: "event_101",
          },
        },
      },
    ];

    test.each(arrange)("when input is $input", async ({ input, expected }) => {
      const audience = AudienceFakeBuilder.aAudience().withBadges([]).build();
      repository.items = [audience];
      const musician = Musician.fake().aMusician().build();
      musicianRepository.items = [musician];
      const spyUpdate = jest.spyOn(repository, "update");

      const fullInput = {
        id: audience.audience_id.id,
        ...input,
        qr_code: `soundmeet://musician/${musician.musician_id.id}`,
        musician_id: musician.musician_id.id,
      };

      const output = await useCase.execute(fullInput);

      expect(spyUpdate).toHaveBeenCalledTimes(1);
      expect(output.audience.id).toBe(audience.audience_id.id);
      expect(output.points_earned).toBeInstanceOf(Points);
      expect(output.points_earned.value).toBe(expected.points_earned.value);
      expect(output.points_earned.source).toBe(expected.points_earned.source);
      expect(output.new_badges).toEqual(expected.new_badges);
      expect(output.scan_metadata).toMatchObject({
        ...expected.scan_metadata,
        qr_code: fullInput.qr_code,
        musician_id: musician.musician_id.id,
      });
      expect(output.scan_metadata.scanned_at).toBeInstanceOf(Date);

      const updatedAudience = await repository.findById(audience.audience_id);
      expect(updatedAudience).toBeDefined();
      expect(updatedAudience!.totalPoints).toBe(expected.points_earned.value);
    });
  });

  it("should register a user interaction when scanning QR code", async () => {
    const audience = AudienceFakeBuilder.aAudience().withBadges([]).build();
    repository.items = [audience];
    const musician = Musician.fake().aMusician().build();
    musicianRepository.items = [musician];

    const input: ScanQRInput = {
      id: audience.audience_id.id,
      qr_code: `soundmeet://musician/${musician.musician_id.id}`,
      musician_id: musician.musician_id.id,
      establishment_id: "establishment_1",
      location: {
        latitude: -23.5505,
        longitude: -46.6333,
      },
    };

    const output = await useCase.execute(input);

    expect(output.points_earned).toBeInstanceOf(Points);
    expect(userInteractionRepo.items).toHaveLength(1);

    const interaction = userInteractionRepo.items[0];
    expect(interaction.user_id.id).toBe(audience.audience_id.id);
    expect(interaction.interaction_type).toBe("scan_qr");
    expect(interaction.target_id).toBe(input.musician_id);
    expect(interaction.points_earned).toBe(output.points_earned.value);
    expect(interaction.metadata).toMatchObject({
      establishment_id: input.establishment_id,
      location: input.location,
    } as any);
  });

  it("should not block scan when daily limit is reached and should not earn points", async () => {
    const audience = AudienceFakeBuilder.aAudience()
      .withBadges(["iniciante"])
      .withTotalPoints(50)
      .build();
    repository.items = [audience];

    const musician = Musician.fake().aMusician().build();
    musicianRepository.items = [musician];
    const musicianId = musician.musician_id.id;

    for (let i = 0; i < 5; i++) {
      userInteractionRepo.items.push(
        UserInteraction.create({
          user_id: audience.audience_id.id,
          interaction_type: "scan_qr",
          target_id: musicianId,
          metadata: {
            timestamp: new Date().toISOString(),
          } as any,
          points_earned: 10,
        }),
      );
    }

    const input: ScanQRInput = {
      id: audience.audience_id.id,
      qr_code: `soundmeet://musician/${musicianId}`,
      musician_id: musicianId,
    };

    const output = await useCase.execute(input);

    expect(output.points_earned).toBeInstanceOf(Points);
    expect(output.points_earned.value).toBe(0);
    expect(output.audience.points.total).toBe(50);
    expect(userInteractionRepo.items).toHaveLength(6);
  });

  it("should handle multiple QR scans and accumulate points", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    repository.items = [audience];
    const musician1 = Musician.fake().aMusician().build();
    const musician2 = Musician.fake().aMusician().build();
    musicianRepository.items = [musician1, musician2];

    const input1: ScanQRInput = {
      id: audience.audience_id.id,
      qr_code: `soundmeet://musician/${musician1.musician_id.id}`,
      musician_id: musician1.musician_id.id,
    };

    const input2: ScanQRInput = {
      id: audience.audience_id.id,
      qr_code: `soundmeet://musician/${musician2.musician_id.id}`,
      musician_id: musician2.musician_id.id,
    };

    const output1 = await useCase.execute(input1);
    const output2 = await useCase.execute(input2);

    expect(output1.points_earned).toBeInstanceOf(Points);
    expect(output1.points_earned.value).toBe(10);
    expect(output2.points_earned).toBeInstanceOf(Points);
    expect(output2.points_earned.value).toBe(10);
    expect(output2.audience.points.total).toBe(20); // 10 points per scan

    // Verify both audiences were updated
    const updatedAudience = await repository.findById(audience.audience_id);
    expect(updatedAudience).toBeDefined();
    expect(updatedAudience!.totalPoints).toBe(20); // Total accumulated points
  });

  it("should update level when points threshold is reached", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    // Set initial points close to level threshold
    audience.addPoints(90); // Assuming level threshold is at 100 points
    repository.items = [audience];

    const musician = Musician.fake().aMusician().build();
    musicianRepository.items = [musician];

    const input: ScanQRInput = {
      id: audience.audience_id.id,
      qr_code: `soundmeet://musician/${musician.musician_id.id}`,
      musician_id: musician.musician_id.id,
    };

    const output = await useCase.execute(input);

    expect(output.points_earned).toBeInstanceOf(Points);
    expect(output.points_earned.value).toBe(10);
    expect(output.new_level).toBeDefined();
    expect(output.audience.points.total).toBe(100); // 90 + 10 = 100
  });

  it("should reject QR code with invalid scheme", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    repository.items = [audience];

    await expect(() =>
      useCase.execute({
        id: audience.audience_id.id,
        qr_code: `https://soundmeet.app/musician/${new Uuid().id}`,
      }),
    ).rejects.toThrow(InvalidArgumentError);
  });

  it("should reject QR code with invalid musician UUID", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    repository.items = [audience];

    await expect(() =>
      useCase.execute({
        id: audience.audience_id.id,
        qr_code: "soundmeet://musician/musician_123",
      }),
    ).rejects.toThrow(InvalidArgumentError);
  });

  it("should reject musician_id different from QR code", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    repository.items = [audience];
    const musician = Musician.fake().aMusician().build();
    musicianRepository.items = [musician];

    await expect(() =>
      useCase.execute({
        id: audience.audience_id.id,
        qr_code: `soundmeet://musician/${musician.musician_id.id}`,
        musician_id: new Uuid().id,
      }),
    ).rejects.toThrow(InvalidArgumentError);
  });

  it("should reject inactive musician before scoring", async () => {
    const audience = AudienceFakeBuilder.aAudience().build();
    repository.items = [audience];
    const musician = Musician.fake().aMusician().deactivate().build();
    musicianRepository.items = [musician];

    await expect(() =>
      useCase.execute({
        id: audience.audience_id.id,
        qr_code: `soundmeet://musician/${musician.musician_id.id}`,
      }),
    ).rejects.toThrow(InvalidArgumentError);
    expect(userInteractionRepo.items).toHaveLength(0);
  });
});
