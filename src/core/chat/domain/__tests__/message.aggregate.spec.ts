import { Message } from "../message.aggregate";
import { EntityValidationError } from "../../../shared/domain/validators/validation.error";

const validCmd = {
  conversation_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  sender_id: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
  sender_type: "musician" as const,
  content: "Topamos o cachê de R$500",
};

describe("Message aggregate", () => {
  describe("create()", () => {
    it("should create with status=sent and read_at=null", () => {
      const msg = Message.create(validCmd);
      expect(msg.message_id).toBeDefined();
      expect(msg.status).toBe("sent");
      expect(msg.read_at).toBeNull();
      expect(msg.content).toBe(validCmd.content);
    });

    it("should throw EntityValidationError when content is empty string", () => {
      expect(() => Message.create({ ...validCmd, content: "" })).toThrow(
        EntityValidationError,
      );
    });

    it("should throw EntityValidationError when content exceeds 2000 chars", () => {
      expect(() =>
        Message.create({ ...validCmd, content: "x".repeat(2001) }),
      ).toThrow(EntityValidationError);
    });

    it("should throw EntityValidationError when sender_type is invalid", () => {
      expect(() =>
        Message.create({ ...validCmd, sender_type: "audience" as any }),
      ).toThrow(EntityValidationError);
    });

    it("should throw EntityValidationError when conversation_id is not a UUID", () => {
      expect(() =>
        Message.create({ ...validCmd, conversation_id: "not-a-uuid" }),
      ).toThrow(EntityValidationError);
    });
  });

  describe("markRead()", () => {
    it("should change status to read and set read_at", () => {
      const msg = Message.create(validCmd);
      msg.markRead();
      expect(msg.status).toBe("read");
      expect(msg.read_at).toBeInstanceOf(Date);
    });

    it("should be idempotent — calling twice does not reset read_at", () => {
      const msg = Message.create(validCmd);
      msg.markRead();
      const firstReadAt = msg.read_at!.getTime();
      msg.markRead();
      expect(msg.read_at!.getTime()).toBe(firstReadAt);
    });
  });

  describe("toJSON()", () => {
    it("should return serializable object with all fields", () => {
      const msg = Message.create(validCmd);
      const json = msg.toJSON();
      expect(json).toHaveProperty("message_id");
      expect(json).toHaveProperty("conversation_id", validCmd.conversation_id);
      expect(json).toHaveProperty("sender_id", validCmd.sender_id);
      expect(json).toHaveProperty("sender_type", "musician");
      expect(json).toHaveProperty("content", validCmd.content);
      expect(json).toHaveProperty("status", "sent");
      expect(json).toHaveProperty("read_at", null);
    });
  });

  describe("fake()", () => {
    it("should build a valid Message instance", () => {
      const msg = Message.fake().aMessage().build();
      expect(msg).toBeInstanceOf(Message);
      expect(msg.message_id).toBeDefined();
      expect(msg.status).toBe("sent");
    });
  });
});
