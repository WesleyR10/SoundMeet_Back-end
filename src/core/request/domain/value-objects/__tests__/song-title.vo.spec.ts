import { SongTitle } from "../song-title.vo";

describe("SongTitle Unit Tests", () => {
  describe("constructor", () => {
    test("should create with valid song title", () => {
      const title = new SongTitle("Bohemian Rhapsody");
      expect(title.value).toBe("Bohemian Rhapsody");
    });

    test("should create with minimum length title", () => {
      const title = new SongTitle("A");
      expect(title.value).toBe("A");
    });

    test("should create with maximum length title", () => {
      const longTitle = "A".repeat(200);
      const title = new SongTitle(longTitle);
      expect(title.value).toBe(longTitle);
    });

    test("should handle empty title", () => {
      expect(() => new SongTitle("")).toThrow(
        "Song title must have at least 1 character",
      );
    });

    test("should handle too long title", () => {
      const longTitle = "a".repeat(201);
      expect(() => new SongTitle(longTitle)).toThrow(
        "Song title cannot exceed 200 characters",
      );
    });

    test("should handle null title", () => {
      expect(() => new SongTitle(null as any)).toThrow(
        "Song title is required and must be a string",
      );
    });

    test("should handle undefined title", () => {
      expect(() => new SongTitle(undefined as any)).toThrow(
        "Song title is required and must be a string",
      );
    });

    test("should handle whitespace-only title", () => {
      expect(() => new SongTitle("   ")).toThrow(
        "Song title must have at least 1 character",
      );
    });
  });

  describe("dangerous characters validation", () => {
    test("should throw error with script tags", () => {
      expect(() => new SongTitle("<script>alert('xss')</script>")).toThrow(
        "Song title contains invalid characters",
      );
    });

    test("should throw error with iframe tags", () => {
      expect(
        () => new SongTitle("<iframe src='malicious.com'></iframe>"),
      ).toThrow("Song title contains invalid characters");
    });

    test("should throw error with javascript protocol", () => {
      expect(() => new SongTitle("javascript:alert('xss')")).toThrow(
        "Song title contains invalid characters",
      );
    });

    test("should throw error with data protocol", () => {
      expect(
        () => new SongTitle("data:text/html,<script>alert('xss')</script>"),
      ).toThrow("Song title contains invalid characters");
    });

    test("should throw error with vbscript protocol", () => {
      expect(() => new SongTitle("vbscript:msgbox('xss')")).toThrow(
        "Song title contains invalid characters",
      );
    });

    test("should throw error with on event handlers", () => {
      const dangerousTitles = [
        "Song onclick='alert(1)'",
        "Title onload='malicious()'",
        "Music onmouseover='hack()'",
      ];

      dangerousTitles.forEach((title) => {
        expect(() => new SongTitle(title)).toThrow(
          "Song title contains invalid characters",
        );
      });
    });
  });

  describe("valid characters", () => {
    test("should accept titles with common music characters", () => {
      const validTitles = [
        "Bohemian Rhapsody",
        "Do not Stop Me Now",
        "We Will Rock You",
        "Another One Bites the Dust",
        "Under Pressure (feat. David Bowie)",
        "The Show Must Go On",
        "I Want to Break Free",
        "Somebody to Love",
        "We Are the Champions",
        "Radio Ga Ga",
      ];

      validTitles.forEach((title) => {
        expect(() => new SongTitle(title)).not.toThrow();
      });
    });

    test("should accept titles with numbers and special characters", () => {
      const validTitles = [
        "Track #1",
        "Song 2.0",
        "Music and Love",
        "Rock n Roll",
        "Song (Remix)",
        "Title - Extended Version",
        "Music: The Beginning",
        "Song; Part II",
        "Title, Vol. 1",
      ];

      validTitles.forEach((title) => {
        expect(() => new SongTitle(title)).not.toThrow();
      });
    });

    test("should accept titles with unicode characters", () => {
      const unicodeTitles = [
        "Música Brasileira",
        "Canción Española",
        "Chanson Française",
        "Deutsche Musik",
        "Русская Песня",
        "日本の歌",
        "中国音乐",
        "한국 음악",
      ];

      unicodeTitles.forEach((title) => {
        expect(() => new SongTitle(title)).not.toThrow();
      });
    });
  });

  describe("trimming", () => {
    test("should trim whitespace from title", () => {
      const title = new SongTitle("  Bohemian Rhapsody  ");
      expect(title.trimmedValue).toBe("Bohemian Rhapsody");
      expect(title.toString()).toBe("Bohemian Rhapsody");
    });

    test("should preserve internal whitespace", () => {
      const title = new SongTitle("We Will Rock You");
      expect(title.value).toBe("We Will Rock You");
    });
  });

  describe("toString", () => {
    test("should return string representation", () => {
      const title = new SongTitle("Bohemian Rhapsody");
      expect(title.toString()).toBe("Bohemian Rhapsody");
    });
  });

  describe("equals", () => {
    test("should return true for same title values", () => {
      const title1 = new SongTitle("Bohemian Rhapsody");
      const title2 = new SongTitle("Bohemian Rhapsody");
      expect(title1.equals(title2)).toBe(true);
    });

    test("should return false for different title values", () => {
      const title1 = new SongTitle("Bohemian Rhapsody");
      const title2 = new SongTitle("We Will Rock You");
      expect(title1.equals(title2)).toBe(false);
    });

    test("should return false when comparing with null", () => {
      const title = new SongTitle("Bohemian Rhapsody");
      expect(title.equals(null as any)).toBe(false);
    });

    test("should return false when comparing with different type", () => {
      const title = new SongTitle("Bohemian Rhapsody");
      expect(title.equals("Bohemian Rhapsody" as any)).toBe(false);
    });

    test("should handle case sensitivity", () => {
      const title1 = new SongTitle("Bohemian Rhapsody");
      const title2 = new SongTitle("BOHEMIAN RHAPSODY");
      expect(title1.equals(title2)).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("should handle titles with only numbers", () => {
      const title = new SongTitle("1234567890");
      expect(title.value).toBe("1234567890");
    });

    test("should handle titles with mixed content", () => {
      const title = new SongTitle("Song #1: Rock and Roll! (2023 Remix)");
      expect(title.value).toBe("Song #1: Rock and Roll! (2023 Remix)");
    });

    test("should handle titles with line breaks", () => {
      const titleWithBreaks = "Song Title\nPart Two";
      const title = new SongTitle(titleWithBreaks);
      expect(title.value).toBe(titleWithBreaks);
    });
  });
});
