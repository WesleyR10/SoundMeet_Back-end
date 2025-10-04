import { RequestMessage } from "../request-message.vo";

describe("RequestMessage Unit Tests", () => {
  describe("constructor", () => {
    test("should create with valid message", () => {
      const message = new RequestMessage("Please play this song!");
      expect(message.value).toBe("Please play this song!");
    });

    test("should create with minimum length message", () => {
      const message = new RequestMessage("A");
      expect(message.value).toBe("A");
    });

    test("should create with maximum length message", () => {
      const longMessage = "A".repeat(500);
      const message = new RequestMessage(longMessage);
      expect(message.value).toBe(longMessage);
    });

    test("should handle empty message", () => {
      expect(() => new RequestMessage("")).toThrow(
        "Request message must have at least 1 character",
      );
    });

    test("should throw error with message too long", () => {
      const tooLongMessage = "A".repeat(501);
      expect(() => new RequestMessage(tooLongMessage)).toThrow(
        "Request message cannot exceed 500 characters",
      );
    });

    test("should handle null message", () => {
      expect(() => new RequestMessage(null as any)).toThrow(
        "Request message is required and must be a string",
      );
    });

    test("should handle undefined message", () => {
      expect(() => new RequestMessage(undefined as any)).toThrow(
        "Request message is required and must be a string",
      );
    });

    test("should handle whitespace-only message", () => {
      expect(() => new RequestMessage("   ")).toThrow(
        "Request message must have at least 1 character",
      );
    });
  });

  describe("validation", () => {
    test("should accept valid messages with different characters", () => {
      const validMessages = [
        "Please play this song!",
        "Can you play some rock music? 🎸",
        "I love this band - they're amazing!",
        "Play something from the 80s, please.",
        "123 Test message with numbers",
        "Message with special chars: @#$%^&*()",
      ];

      validMessages.forEach((msg) => {
        expect(() => new RequestMessage(msg)).not.toThrow();
      });
    });

    test("should trim whitespace from message", () => {
      const message = new RequestMessage("  Please play this song!  ");
      expect(message.trimmedValue).toBe("Please play this song!");
      expect(message.toString()).toBe("Please play this song!");
    });

    test("should handle messages with line breaks", () => {
      const messageWithBreaks = "Please play this song!\nIt's my favorite.";
      const message = new RequestMessage(messageWithBreaks);
      expect(message.value).toBe(messageWithBreaks);
    });

    test("should handle messages with tabs", () => {
      const messageWithTabs = "Please play\tthis song!";
      const message = new RequestMessage(messageWithTabs);
      expect(message.value).toBe(messageWithTabs);
    });
  });

  describe("toString", () => {
    test("should return string representation", () => {
      const message = new RequestMessage("Please play this song!");
      expect(message.toString()).toBe("Please play this song!");
    });
  });

  describe("equals", () => {
    test("should return true for same message values", () => {
      const message1 = new RequestMessage("Please play this song!");
      const message2 = new RequestMessage("Please play this song!");
      expect(message1.equals(message2)).toBe(true);
    });

    test("should return false for different message values", () => {
      const message1 = new RequestMessage("Please play this song!");
      const message2 = new RequestMessage("Please play another song!");
      expect(message1.equals(message2)).toBe(false);
    });

    test("should return false when comparing with null", () => {
      const message = new RequestMessage("Please play this song!");
      expect(message.equals(null as any)).toBe(false);
    });

    test("should return false when comparing with different type", () => {
      const message = new RequestMessage("Please play this song!");
      expect(message.equals("Please play this song!" as any)).toBe(false);
    });

    test("should handle case sensitivity", () => {
      const message1 = new RequestMessage("Please play this song!");
      const message2 = new RequestMessage("PLEASE PLAY THIS SONG!");
      expect(message1.equals(message2)).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("should handle unicode characters", () => {
      const unicodeMessage = "Please play this song! 🎵🎶🎸";
      const message = new RequestMessage(unicodeMessage);
      expect(message.value).toBe(unicodeMessage);
    });

    test("should handle messages with only numbers", () => {
      const numberMessage = "123456789";
      const message = new RequestMessage(numberMessage);
      expect(message.value).toBe(numberMessage);
    });

    test("should handle messages with mixed content", () => {
      const mixedMessage = "Song #1: Rock & Roll! (Please play it) 🎸";
      const message = new RequestMessage(mixedMessage);
      expect(message.value).toBe(mixedMessage);
    });
  });
});
