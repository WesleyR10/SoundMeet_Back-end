import { SortDirection } from "../../../../../shared/domain/repository/search-params";
import { Audience } from "../../../../domain/audience.aggregate";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { ListAudiencesUseCase } from "../list-audiences.use-case";

describe("ListAudiencesUseCase Unit Tests", () => {
  let useCase: ListAudiencesUseCase;
  let repository: AudienceInMemoryRepository;

  beforeEach(() => {
    repository = new AudienceInMemoryRepository();
    useCase = new ListAudiencesUseCase(repository);
  });

  it("should return empty list when no audiences", async () => {
    const output = await useCase.execute({});

    expect(output.items).toHaveLength(0);
    expect(output.total).toBe(0);
    expect(output.current_page).toBe(1);
    expect(output.per_page).toBe(15);
    expect(output.last_page).toBe(0);
  });

  it("should list audiences with pagination", async () => {
    const audiences = [
      Audience.fake().aAudience().build(),
      Audience.fake().aAudience().build(),
      Audience.fake().aAudience().build(),
    ];

    for (const audience of audiences) {
      await repository.insert(audience);
    }

    const output = await useCase.execute({ page: 1, per_page: 2 });

    expect(output.items).toHaveLength(2);
    expect(output.total).toBe(3);
    expect(output.current_page).toBe(1);
    expect(output.per_page).toBe(2);
    expect(output.last_page).toBe(2);
  });

  it("should list audiences with filter", async () => {
    const audience1 = Audience.fake().aAudience().withName("John Doe").build();
    const audience2 = Audience.fake().aAudience().withName("Jane Smith").build();
    const audience3 = Audience.fake().aAudience().withName("Bob Johnson").build();

    await repository.insert(audience1);
    await repository.insert(audience2);
    await repository.insert(audience3);

    const output = await useCase.execute({ filter: { name: "John" } });

    expect(output.items).toHaveLength(2);
    expect(output.total).toBe(2);
    expect(output.items[0].name).toBe("John Doe");
    expect(output.items[1].name).toBe("Bob Johnson");
  });

  it("should list audiences with sort", async () => {
    const audience1 = Audience.fake().aAudience().withName("Charlie").build();
    const audience2 = Audience.fake().aAudience().withName("Alpha").build();
    const audience3 = Audience.fake().aAudience().withName("Beta").build();

    await repository.insert(audience1);
    await repository.insert(audience2);
    await repository.insert(audience3);

    const output = await useCase.execute({
      sort: "name",
      sort_dir: "asc" as SortDirection,
    });

    expect(output.items).toHaveLength(3);
    expect(output.items[0].name).toBe("Alpha");
    expect(output.items[1].name).toBe("Beta");
    expect(output.items[2].name).toBe("Charlie");
  });

  it("should list audiences with email filter", async () => {
    const audience1 = Audience.fake().aAudience().withEmail("user1@example.com").build();
    const audience2 = Audience.fake().aAudience().withEmail("user2@example.com").build();
    const audience3 = Audience.fake().aAudience().withEmail("other@domain.com").build();

    await repository.insert(audience1);
    await repository.insert(audience2);
    await repository.insert(audience3);

    const output = await useCase.execute({ filter: { email: "example.com" } });

    expect(output.items).toHaveLength(2);
    expect(output.total).toBe(2);
    expect(output.items[0].email).toBe("user1@example.com");
    expect(output.items[1].email).toBe("user2@example.com");
  });

  it("should list audiences with level filter", async () => {
    const audience1 = Audience.fake().aAudience().withCurrentLevel(1).build();
    const audience2 = Audience.fake().aAudience().withCurrentLevel(2).build();
    const audience3 = Audience.fake().aAudience().withCurrentLevel(3).build();

    await repository.insert(audience1);
    await repository.insert(audience2);
    await repository.insert(audience3);

    const output = await useCase.execute({ filter: { min_level: 2 } });

    expect(output.items).toHaveLength(2);
    expect(output.total).toBe(2);
    expect(output.items[0].level.level).toBeGreaterThanOrEqual(2);
    expect(output.items[1].level.level).toBeGreaterThanOrEqual(2);
  });

  it("should list audiences with genre filter", async () => {
    const audience1 = Audience.fake()
      .aAudience()
      .withFavoriteGenres(["Rock", "Pop"])
      .build();
    const audience2 = Audience.fake()
      .aAudience()
      .withFavoriteGenres(["Jazz", "Blues"])
      .build();
    const audience3 = Audience.fake()
      .aAudience()
      .withFavoriteGenres(["Rock", "Metal"])
      .build();

    await repository.insert(audience1);
    await repository.insert(audience2);
    await repository.insert(audience3);

    const output = await useCase.execute({
      filter: { favorite_genres: ["Rock"] },
    });

    expect(output.items).toHaveLength(2);
    expect(output.total).toBe(2);
    expect(output.items[0].preferences.favorite_genres).toContain("Rock");
    expect(output.items[1].preferences.favorite_genres).toContain("Rock");
  });

  it("should list audiences with instrument filter", async () => {
    const audience1 = Audience.fake()
      .aAudience()
      .withFavoriteInstruments(["Guitar", "Bass"])
      .build();
    const audience2 = Audience.fake()
      .aAudience()
      .withFavoriteInstruments(["Drums"])
      .build();
    const audience3 = Audience.fake()
      .aAudience()
      .withFavoriteInstruments(["Guitar", "Piano"])
      .build();

    await repository.insert(audience1);
    await repository.insert(audience2);
    await repository.insert(audience3);

    const output = await useCase.execute({
      filter: { favorite_instruments: ["Guitar"] },
    });

    expect(output.items).toHaveLength(2);
    expect(output.total).toBe(2);
    expect(output.items[0].preferences.favorite_instruments).toContain(
      "Guitar",
    );
    expect(output.items[1].preferences.favorite_instruments).toContain(
      "Guitar",
    );
  });

  it("should list audiences with active status filter", async () => {
    const audience1 = Audience.fake().aAudience().withIsActive(true).build();
    const audience2 = Audience.fake().aAudience().withIsActive(false).build();
    const audience3 = Audience.fake().aAudience().withIsActive(true).build();

    await repository.insert(audience1);
    await repository.insert(audience2);
    await repository.insert(audience3);

    const output = await useCase.execute({ filter: { is_active: true } });

    expect(output.items).toHaveLength(2);
    expect(output.total).toBe(2);
    expect(output.items[0].is_active).toBe(true);
    expect(output.items[1].is_active).toBe(true);
  });
});
