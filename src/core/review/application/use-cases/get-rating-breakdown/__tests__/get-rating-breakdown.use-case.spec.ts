import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Review, ReviewAuthorType } from "../../../../domain/review.aggregate";
import { ReviewInMemoryRepository } from "../../../../infra/db/in-memory/review-in-memory.repository";
import { GetRatingBreakdownUseCase } from "../get-rating-breakdown.use-case";

describe("GetRatingBreakdownUseCase Unit Tests", () => {
  let useCase: GetRatingBreakdownUseCase;
  let repository: ReviewInMemoryRepository;
  const musicianId = new Uuid().id;

  beforeEach(() => {
    repository = new ReviewInMemoryRepository();
    useCase = new GetRatingBreakdownUseCase(repository);
  });

  const review = (author_type: ReviewAuthorType, rating: number) =>
    Review.create({
      target_type: "musician",
      target_id: musicianId,
      author_type,
      author_id: new Uuid().id,
      rating,
      context_type: author_type === "audience" ? "event" : "booking",
      context_id: new Uuid().id,
    });

  it("devolve zeros e todas as parciais nulas quando não há avaliação", async () => {
    const output = await useCase.execute({
      target_type: "musician",
      target_id: musicianId,
    });

    expect(output.overall).toEqual({ average: 0, total: 0 });
    expect(output.by_author).toEqual({
      audience: null,
      establishment: null,
      musician: null,
    });
  });

  it("🔴 tipo de autor sem avaliação vem null, NUNCA zero", async () => {
    await repository.insert(review("establishment", 4));

    const output = await useCase.execute({
      target_type: "musician",
      target_id: musicianId,
    });

    expect(output.by_author.establishment).toEqual({ average: 4, total: 1 });
    // Zero leria como "avaliado mal"; a diferença entre isso e "não avaliado"
    // é o motivo desta quebra existir.
    expect(output.by_author.audience).toBeNull();
    expect(output.by_author.musician).toBeNull();
  });

  it("separa as médias por autor e mantém todas as chaves presentes", async () => {
    await repository.bulkInsert([
      review("establishment", 5),
      review("establishment", 3),
      review("audience", 4),
      review("audience", 5),
      review("audience", 3),
      review("musician", 2),
    ]);

    const output = await useCase.execute({
      target_type: "musician",
      target_id: musicianId,
    });

    expect(output.by_author.establishment).toEqual({ average: 4, total: 2 });
    expect(output.by_author.audience).toEqual({ average: 4, total: 3 });
    expect(output.by_author.musician).toEqual({ average: 2, total: 1 });
  });

  /*
   * 🔴 O teste que justifica o desenho do output: `overall` é a média
   * PONDERADA do ledger, não a média das três médias. Aqui as parciais são
   * 5, 1 e 1 (média das médias = 2.33), e a real é 3.4 — porque o público
   * avaliou cinco vezes e os outros uma cada.
   */
  it("🔴 overall NÃO é a média das parciais — os pesos diferem", async () => {
    await repository.bulkInsert([
      review("audience", 5),
      review("audience", 5),
      review("audience", 5),
      review("audience", 5),
      review("audience", 5),
      review("establishment", 1),
      review("musician", 1),
    ]);

    const output = await useCase.execute({
      target_type: "musician",
      target_id: musicianId,
    });

    const mediaDasMedias =
      (output.by_author.audience!.average +
        output.by_author.establishment!.average +
        output.by_author.musician!.average) /
      3;

    expect(output.overall).toEqual({ average: 3.9, total: 7 });
    expect(mediaDasMedias).toBeCloseTo(2.33, 1);
    expect(output.overall.average).not.toBeCloseTo(mediaDasMedias, 1);
  });

  it("não mistura o ledger de outro alvo", async () => {
    const outroMusico = new Uuid().id;
    await repository.bulkInsert([
      review("audience", 5),
      Review.create({
        target_type: "musician",
        target_id: outroMusico,
        author_type: "audience",
        author_id: new Uuid().id,
        rating: 1,
        context_type: "event",
        context_id: new Uuid().id,
      }),
    ]);

    const output = await useCase.execute({
      target_type: "musician",
      target_id: musicianId,
    });

    expect(output.overall).toEqual({ average: 5, total: 1 });
    expect(output.by_author.audience).toEqual({ average: 5, total: 1 });
  });

  it("arredonda para uma casa — é o que o VO Rating aceita", async () => {
    await repository.bulkInsert([
      review("audience", 5),
      review("audience", 4),
      review("audience", 4),
    ]);

    const output = await useCase.execute({
      target_type: "musician",
      target_id: musicianId,
    });

    // 13/3 = 4.333… → 4.3, nunca 4.333333333333333
    expect(output.by_author.audience).toEqual({ average: 4.3, total: 3 });
  });
});
