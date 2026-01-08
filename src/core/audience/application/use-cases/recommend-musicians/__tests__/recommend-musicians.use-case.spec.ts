import { Musician } from "../../../../../musician/domain/musician.aggregate";
import { Audience } from "../../../../domain/audience.aggregate";
import { AudienceInMemoryRepository } from "../../../../infra/db/in-memory/audience-in-memory.repository";
import { RecommendMusiciansUseCase } from "../recommend-musicians.use-case";

describe("RecommendMusiciansUseCase", () => {
  it("should recommend musicians using audience favorite instruments and genres", async () => {
    const audienceRepo = new AudienceInMemoryRepository();
    const musicianRepo = {
      search: jest.fn(),
    } as any;

    const audience = Audience.create({
      email: "john@example.com",
      name: "John",
      favorite_instruments: ["Guitar"],
      favorite_genres: ["Rock"],
    });
    await audienceRepo.insert(audience);

    const musicians = [
      Musician.fake().aMusician().withInstruments(["Guitar"]).build(),
      Musician.fake().aMusician().withInstruments(["Guitar"]).build(),
    ];

    musicianRepo.search.mockResolvedValue({
      items: musicians,
      total: musicians.length,
      current_page: 1,
      per_page: 10,
      last_page: 1,
    });

    const useCase = new RecommendMusiciansUseCase(
      audienceRepo as any,
      musicianRepo,
    );
    const output = await useCase.execute({
      audience_id: audience.audience_id.id,
    });

    expect(musicianRepo.search).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({
          is_active: true,
          instruments: ["Guitar"],
          genres: ["Rock"],
        }),
      }),
    );
    expect(output.items).toHaveLength(2);
    expect(output.items[0]).toHaveProperty("id");
    expect(output.items[0]).toHaveProperty("instruments");
  });
});
