import { Conversation } from "../conversation.aggregate";
import { EntityValidationError } from "../../../shared/domain/validators/validation.error";

const validProps = {
  inquiry_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  establishment_id: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
  musician_id: "f47ac10b-58cc-4372-a567-0e02b2c3d481",
  band_id: null as string | null,
};

describe("Conversation aggregate", () => {
  describe("create()", () => {
    it("should create a valid conversation with musician_id", () => {
      const conv = Conversation.create(validProps);
      expect(conv.conversation_id).toBeDefined();
      expect(conv.inquiry_id).toBe(validProps.inquiry_id);
      expect(conv.establishment_id).toBe(validProps.establishment_id);
      expect(conv.musician_id).toBe(validProps.musician_id);
      expect(conv.band_id).toBeNull();
    });

    it("should create a valid conversation with band_id (musician_id null)", () => {
      const conv = Conversation.create({
        ...validProps,
        musician_id: null,
        band_id: "f47ac10b-58cc-4372-a567-0e02b2c3d482",
      });
      expect(conv.band_id).toBe("f47ac10b-58cc-4372-a567-0e02b2c3d482");
      expect(conv.musician_id).toBeNull();
    });

    it("should throw EntityValidationError when inquiry_id is not a valid UUID", () => {
      expect(() =>
        Conversation.create({ ...validProps, inquiry_id: "not-a-uuid" }),
      ).toThrow(EntityValidationError);
    });

    it("should throw EntityValidationError when establishment_id is empty", () => {
      expect(() =>
        Conversation.create({ ...validProps, establishment_id: "" }),
      ).toThrow(EntityValidationError);
    });

    it("should assign a new conversation_id automatically", () => {
      const conv1 = Conversation.create(validProps);
      const conv2 = Conversation.create(validProps);
      expect(conv1.conversation_id.id).not.toBe(conv2.conversation_id.id);
    });

    it("should set created_at and updated_at to now by default", () => {
      const before = new Date();
      const conv = Conversation.create(validProps);
      const after = new Date();
      expect(conv.created_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(conv.created_at.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("toJSON()", () => {
    it("should return serializable object with all fields", () => {
      const conv = Conversation.create(validProps);
      const json = conv.toJSON();
      expect(json).toHaveProperty("conversation_id");
      expect(json).toHaveProperty("inquiry_id", validProps.inquiry_id);
      expect(json).toHaveProperty("establishment_id", validProps.establishment_id);
      expect(json).toHaveProperty("musician_id", validProps.musician_id);
      expect(json).toHaveProperty("band_id", null);
      expect(json).toHaveProperty("created_at");
      expect(json).toHaveProperty("updated_at");
    });
  });

  describe("fake()", () => {
    it("should build a valid Conversation instance", () => {
      const conv = Conversation.fake().aConversation().build();
      expect(conv).toBeInstanceOf(Conversation);
      expect(conv.conversation_id).toBeDefined();
      expect(conv.inquiry_id).toBeDefined();
    });

    it("should allow overriding establishment_id", () => {
      const conv = Conversation.fake()
        .aConversation()
        .withEstablishmentId("f47ac10b-58cc-4372-a567-0e02b2c3d480")
        .build();
      expect(conv.establishment_id).toBe("f47ac10b-58cc-4372-a567-0e02b2c3d480");
    });
  });
});
