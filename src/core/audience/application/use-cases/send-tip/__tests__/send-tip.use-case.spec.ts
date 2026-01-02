import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import {
  InvalidUuidError,
  Uuid,
} from "../../../../../shared/domain/value-objects/uuid.vo";
import { Audience } from "../../../../domain/audience.aggregate";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { SendTipInput } from "../send-tip.input";
import { SendTipUseCase } from "../send-tip.use-case";

describe("SendTipUseCase Unit Tests", () => {
  let useCase: SendTipUseCase;
  let repository: AudienceInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    useCase = new SendTipUseCase(repository);
  });

  it("should throw error when audience not found", async () => {
    const audienceId = new Uuid();
    const input: SendTipInput = {
      id: audienceId.id,
      amount: 10.0,
      musician_id: "musician_123",
      payment_method: "pix",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(audienceId.id, Audience),
    );
  });

  it("should throw error when id is not valid", async () => {
    const input: SendTipInput = {
      id: "invalid-id",
      amount: 10.0,
      musician_id: "musician_123",
      payment_method: "pix",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  describe("should send tip", () => {
    const arrange = [
      {
        input: {
          amount: 5.0,
          musician_id: "musician_123",
          payment_method: "pix",
        },
        expected: {
          points_earned: 5,
          new_badges: [],
          tip_metadata: {
            musician_id: "musician_123",
            amount: 5.0,
            status: "success",
          },
        },
      },
      {
        input: {
          amount: 25.0,
          musician_id: "musician_456",
          message: "Great performance!",
          establishment_id: "establishment_789",
          event_id: "event_101",
          payment_method: "pix",
          metadata: {
            device_info: "iPhone 12",
            app_version: "1.0.0",
          },
        },
        expected: {
          points_earned: 25,
          new_badges: [],
          tip_metadata: {
            musician_id: "musician_456",
            amount: 25.0,
            message: "Great performance!",
            establishment_id: "establishment_789",
            event_id: "event_101",
            payment_method: "pix",
            status: "success",
          },
        },
      },
    ];

    test.each(arrange)("when input is $input", async ({ input, expected }) => {
      const audience = Audience.fake().aAudience().build();
      repository.items = [audience];
      const spyUpdate = jest.spyOn(repository, "update");

      const fullInput: SendTipInput = {
        id: audience.id.id,
        ...input,
      } as SendTipInput;

      const output = await useCase.execute(fullInput);

      expect(spyUpdate).toHaveBeenCalledTimes(1);
      expect(output.audience.id).toBe(audience.id.id);
      expect(output.points_earned).toBe(expected.points_earned);
      expect(output.new_badges).toEqual(expected.new_badges);
      expect(output.tip_metadata).toMatchObject(expected.tip_metadata);
      expect(output.tip_metadata.sent_at).toBeInstanceOf(Date);

      // Verify audience was updated in repository
      const updatedAudience = await repository.findById(audience.id);
      expect(updatedAudience).toBeDefined();
      expect(updatedAudience!.totalPoints).toBe(expected.points_earned);
    });
  });

  it("should handle multiple tips and accumulate points", async () => {
    const audience = Audience.fake().aAudience().build();
    repository.items = [audience];

    const input1: SendTipInput = {
      id: audience.id.id,
      amount: 10.0,
      musician_id: "musician_123",
      payment_method: "pix",
    };

    const input2: SendTipInput = {
      id: audience.id.id,
      amount: 15.0,
      musician_id: "musician_456",
      payment_method: "pix",
    };

    const output1 = await useCase.execute(input1);
    const output2 = await useCase.execute(input2);

    expect(output1.points_earned).toBe(10);
    expect(output2.points_earned).toBe(15);
    expect(output2.audience.points.total).toBe(25); // 10 + 15 points

    // Verify final state in repository
    const finalAudience = await repository.findById(audience.id);
    expect(finalAudience!.totalPoints).toBe(25);
  });

  it("should handle tip with all optional fields", async () => {
    const audience = Audience.fake().aAudience().build();
    repository.items = [audience];

    const input: SendTipInput = {
      id: audience.id.id,
      amount: 50.0,
      musician_id: "musician_789",
      message: "Amazing show! Keep it up!",
      establishment_id: "establishment_456",
      event_id: "event_123",
      payment_method: "credit_card",
      metadata: {
        device_info: "Samsung Galaxy S21",
        app_version: "2.1.0",
        network_type: "wifi",
        transaction_id: "txn_123456789",
      },
    };

    const output = await useCase.execute(input);

    expect(output.tip_metadata.message).toBe("Amazing show! Keep it up!");
    expect(output.tip_metadata.establishment_id).toBe("establishment_456");
    expect(output.tip_metadata.event_id).toBe("event_123");
    expect(output.tip_metadata.payment_method).toBe("credit_card");
    expect(output.tip_metadata.metadata).toEqual({
      device_info: "Samsung Galaxy S21",
      app_version: "2.1.0",
      network_type: "wifi",
      transaction_id: "txn_123456789",
    });
    expect(output.points_earned).toBe(50); // 1 point per real
  });

  it("should handle large tip amounts correctly", async () => {
    const audience = Audience.fake().aAudience().build();
    repository.items = [audience];

    const input: SendTipInput = {
      id: audience.id.id,
      amount: 100.0,
      musician_id: "musician_999",
      message: "You deserve this!",
      payment_method: "pix",
    };

    const output = await useCase.execute(input);

    expect(output.points_earned).toBe(100);
    expect(output.tip_metadata.amount).toBe(100.0);
    expect(output.audience.points.total).toBe(100);
  });
});
