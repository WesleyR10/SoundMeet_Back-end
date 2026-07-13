import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import {
  InvalidUuidError,
  Uuid,
} from "../../../../../shared/domain/value-objects/uuid.vo";
import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { MusicianPlanTier } from "../../../../../plans/domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../../plans/domain/subscription.aggregate";
import { SubscriptionInMemoryRepository } from "../../../../../plans/infra/db/in-memory/subscription-in-memory.repository";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { GetMusicianInput } from "../get-musician.input";
import { GetMusicianUseCase } from "../get-musician.use-case";

describe("GetMusicianUseCase Unit Tests", () => {
  let useCase: GetMusicianUseCase;
  let repository: MusicianInMemoryRepository;
  let subscriptionRepo: SubscriptionInMemoryRepository;
  let planCheckService: PlanCheckService;

  beforeEach(() => {
    repository = new MusicianInMemoryRepository();
    subscriptionRepo = new SubscriptionInMemoryRepository();
    planCheckService = new PlanCheckService(subscriptionRepo);
    useCase = new GetMusicianUseCase(repository, planCheckService);
  });

  it("should throw error when entity not found", async () => {
    const musicianId = new Uuid();
    const input: GetMusicianInput = {
      id: musicianId.id,
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      new NotFoundError(musicianId.id, Musician),
    );
  });

  it("should throw error when id is not valid", async () => {
    const input: GetMusicianInput = {
      id: "invalid-id",
    };

    await expect(() => useCase.execute(input)).rejects.toThrow(
      InvalidUuidError,
    );
  });

  it("should return a musician", async () => {
    const spyFindById = jest.spyOn(repository, "findById");
    const musician = Musician.fake().aMusician().build();
    repository.items = [musician];

    const input: GetMusicianInput = {
      id: musician.musician_id.id,
    };

    const output = await useCase.execute(input);

    expect(spyFindById).toHaveBeenCalledTimes(1);
    expect(output).toStrictEqual({
      id: musician.musician_id.id,
      name: musician.name,
      stage_name: musician.stage_name,
      email: musician.email.value,
      phone: musician.phone?.value ?? null,
      bio: musician.bio,
      avatar: musician.avatar,
      genres: musician.genres,
      instruments: musician.instruments,
      experience_years: musician.experience_years,
      rating: musician.rating.value,
      total_ratings: musician.total_ratings,
      is_active: musician.is_active,
      is_verified: musician.is_verified,
      profile: musician.profile?.toJSON() ?? null,
      qr_code: musician.qr_code!.code,
      qr_customization: musician.qr_code!.customization ?? null,
      created_at: musician.created_at,
      updated_at: musician.updated_at,
      display_name: musician.displayName,
      is_experienced: musician.isExperienced,
      is_highly_rated: musician.isHighlyRated,
      plan_tier: MusicianPlanTier.FREE,
    });
  });

  it("should return the correct musician when multiple exist", async () => {
    const musician1 = Musician.fake()
      .aMusician()
      .withName("Musician 1")
      .build();
    const musician2 = Musician.fake()
      .aMusician()
      .withName("Musician 2")
      .build();
    const musician3 = Musician.fake()
      .aMusician()
      .withName("Musician 3")
      .build();
    repository.items = [musician1, musician2, musician3];

    const input: GetMusicianInput = {
      id: musician2.musician_id.id,
    };

    const output = await useCase.execute(input);

    expect(output.id).toBe(musician2.musician_id.id);
    expect(output.name).toBe("Musician 2");
  });

  it("should call repository findById method with correct musician id", async () => {
    const spyFindById = jest.spyOn(repository, "findById");
    const musician = Musician.fake().aMusician().build();
    repository.items = [musician];

    const input: GetMusicianInput = {
      id: musician.musician_id.id,
    };

    await useCase.execute(input);

    expect(spyFindById).toHaveBeenCalledWith(musician.musician_id);
  });

  it("should return musician with all properties correctly mapped", async () => {
    const musician = Musician.fake()
      .aMusician()
      .withName("John Doe")
      .withStageName("Johnny Rock")
      .withEmail("john@example.com")
      .withPhone("+5511987654321")
      .withBio("Professional musician")
      .withGenres(["Rock", "Blues"])
      .withInstruments(["Guitar", "Piano"])
      .withExperienceYears(10)
      .activate()
      .build();

    musician.verify();
    repository.items = [musician];

    const input: GetMusicianInput = {
      id: musician.musician_id.id,
    };

    const output = await useCase.execute(input);

    expect(output.name).toBe("John Doe");
    expect(output.stage_name).toBe("Johnny Rock");
    expect(output.email).toBe("john@example.com");
    expect(output.phone).toBe("+5511987654321");
    expect(output.bio).toBe("Professional musician");
    expect(output.genres).toEqual(["Rock", "Blues"]);
    expect(output.instruments).toEqual(["Guitar", "Piano"]);
    expect(output.experience_years).toBe(10);
    expect(output.is_active).toBe(true);
    expect(output.is_verified).toBe(true);
    expect(output.qr_code).toBeDefined();
    expect(output.created_at).toBeInstanceOf(Date);
  });

  describe("plan_tier", () => {
    it("returns FREE when there is no active subscription", async () => {
      const musician = Musician.fake().aMusician().build();
      repository.items = [musician];

      const output = await useCase.execute({ id: musician.musician_id.id });

      expect(output.plan_tier).toBe(MusicianPlanTier.FREE);
    });

    it("returns the active subscription tier (PRO)", async () => {
      const musician = Musician.fake().aMusician().build();
      repository.items = [musician];
      await subscriptionRepo.insert(
        new Subscription({
          musician_id: musician.musician_id.id,
          plan_tier: MusicianPlanTier.PRO,
          persona: "musician",
          status: SubscriptionStatus.ACTIVE,
        }),
      );

      const output = await useCase.execute({ id: musician.musician_id.id });

      expect(output.plan_tier).toBe(MusicianPlanTier.PRO);
    });

    it("returns the active subscription tier (ESSENTIAL)", async () => {
      const musician = Musician.fake().aMusician().build();
      repository.items = [musician];
      await subscriptionRepo.insert(
        new Subscription({
          musician_id: musician.musician_id.id,
          plan_tier: MusicianPlanTier.ESSENTIAL,
          persona: "musician",
          status: SubscriptionStatus.ACTIVE,
        }),
      );

      const output = await useCase.execute({ id: musician.musician_id.id });

      expect(output.plan_tier).toBe(MusicianPlanTier.ESSENTIAL);
    });
  });
});
