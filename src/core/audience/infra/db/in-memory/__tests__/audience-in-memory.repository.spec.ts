import { describe, it } from "@jest/globals";
import { AudienceInMemoryRepository } from "../audience-in-memory.repository";
import { AudienceFakeBuilder } from "../../../../domain/audience-fake.builder";
import { AudienceSearchParams } from "../../../../domain/audience.repository";

describe("AudienceInMemoryRepository", () => {
  let repository: AudienceInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
  });

  describe("applyFilter method", () => {
    it("should return all items when filter is null", async () => {
      const items = [
        AudienceFakeBuilder.aAudience().build(),
        AudienceFakeBuilder.aAudience().build(),
      ];
      const filteredItems = await repository["applyFilter"](items, null);
      expect(filteredItems).toEqual(items);
    });

    it("should filter by name", async () => {
      const items = [
        AudienceFakeBuilder.aAudience().withName("John Doe").build(),
        AudienceFakeBuilder.aAudience().withName("Jane Smith").build(),
        AudienceFakeBuilder.aAudience().withName("Bob Johnson").build(),
      ];
      const filteredItems = await repository["applyFilter"](items, {
        name: "john",
      });
      expect(filteredItems).toHaveLength(2);
      expect(filteredItems[0].name).toBe("John Doe");
      expect(filteredItems[1].name).toBe("Bob Johnson");
    });

    it("should filter by email", async () => {
      const items = [
        AudienceFakeBuilder.aAudience().withEmail("john@example.com").build(),
        AudienceFakeBuilder.aAudience().withEmail("jane@example.com").build(),
        AudienceFakeBuilder.aAudience().withEmail("bob@test.com").build(),
      ];
      const filteredItems = await repository["applyFilter"](items, {
        email: "example",
      });
      expect(filteredItems).toHaveLength(2);
      expect(filteredItems[0].email?.value).toBe("john@example.com");
      expect(filteredItems[1].email?.value).toBe("jane@example.com");
    });

    it("should filter by is_active", async () => {
      const items = [
        AudienceFakeBuilder.aAudience().activate().build(),
        AudienceFakeBuilder.aAudience().deactivate().build(),
        AudienceFakeBuilder.aAudience().activate().build(),
      ];
      const filteredItems = await repository["applyFilter"](items, {
        is_active: true,
      });
      expect(filteredItems).toHaveLength(2);
      expect(filteredItems[0].is_active).toBe(true);
      expect(filteredItems[1].is_active).toBe(true);
    });

    it("should filter by favorite_genres", async () => {
      const items = [
        AudienceFakeBuilder.aAudience()
          .withFavoriteGenres(["Rock", "Pop"])
          .build(),
        AudienceFakeBuilder.aAudience()
          .withFavoriteGenres(["Jazz", "Blues"])
          .build(),
        AudienceFakeBuilder.aAudience()
          .withFavoriteGenres(["Rock", "Metal"])
          .build(),
      ];
      const filteredItems = await repository["applyFilter"](items, {
        favorite_genres: ["Rock"],
      });
      expect(filteredItems).toHaveLength(2);
      expect(filteredItems[0].favorite_genres).toContain("Rock");
      expect(filteredItems[1].favorite_genres).toContain("Rock");
    });

    it("should apply multiple filters", async () => {
      const items = [
        AudienceFakeBuilder.aAudience()
          .withName("John Doe")
          .withEmail("john@example.com")
          .activate()
          .build(),
        AudienceFakeBuilder.aAudience()
          .withName("Jane Smith")
          .withEmail("jane@example.com")
          .deactivate()
          .build(),
        AudienceFakeBuilder.aAudience()
          .withName("John Smith")
          .withEmail("johnsmith@example.com")
          .activate()
          .build(),
      ];
      const filteredItems = await repository["applyFilter"](items, {
        name: "john",
        is_active: true,
      });
      expect(filteredItems).toHaveLength(2);
      expect(filteredItems[0].name).toBe("John Doe");
      expect(filteredItems[1].name).toBe("John Smith");
    });
  });

  describe("applySort method", () => {
    it("should sort by name in ascending order", async () => {
      const items = [
        AudienceFakeBuilder.aAudience().withName("Charlie").build(),
        AudienceFakeBuilder.aAudience().withName("Alice").build(),
        AudienceFakeBuilder.aAudience().withName("Bob").build(),
      ];
      const sortedItems = await repository["applySort"](items, "name", "asc");
      expect(sortedItems[0].name).toBe("Alice");
      expect(sortedItems[1].name).toBe("Bob");
      expect(sortedItems[2].name).toBe("Charlie");
    });

    it("should sort by name in descending order", async () => {
      const items = [
        AudienceFakeBuilder.aAudience().withName("Alice").build(),
        AudienceFakeBuilder.aAudience().withName("Charlie").build(),
        AudienceFakeBuilder.aAudience().withName("Bob").build(),
      ];
      const sortedItems = await repository["applySort"](items, "name", "desc");
      expect(sortedItems[0].name).toBe("Charlie");
      expect(sortedItems[1].name).toBe("Bob");
      expect(sortedItems[2].name).toBe("Alice");
    });

    it("should sort by created_at when sort field is null", async () => {
      const created_at = new Date();
      const items = [
        AudienceFakeBuilder.aAudience()
          .withCreatedAt(new Date(created_at.getTime() + 2000))
          .build(),
        AudienceFakeBuilder.aAudience()
          .withCreatedAt(new Date(created_at.getTime() + 1000))
          .build(),
        AudienceFakeBuilder.aAudience().withCreatedAt(created_at).build(),
      ];
      const sortedItems = await repository["applySort"](items, null, null);
      expect(sortedItems[0].created_at.getTime()).toBeLessThan(
        sortedItems[1].created_at.getTime(),
      );
      expect(sortedItems[1].created_at.getTime()).toBeLessThan(
        sortedItems[2].created_at.getTime(),
      );
    });
  });

  describe("search method", () => {
    it("should apply filter, sort and paginate", async () => {
      const audiences = AudienceFakeBuilder.theAudiences(15)
        .withName((index) => `Audience ${index}`)
        .build();
      repository.items = audiences;

      const searchParams = AudienceSearchParams.create({
        page: 1,
        per_page: 2,
        sort: "name",
        sort_dir: "asc",
        filter: { name: "Audience 1" },
      });

      const result = await repository.search(searchParams);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(6); // Audience 1, 10, 11, 12, 13, 14 (contém "Audience 1")
      expect(result.current_page).toBe(1);
      expect(result.per_page).toBe(2);
    });
  });
});
