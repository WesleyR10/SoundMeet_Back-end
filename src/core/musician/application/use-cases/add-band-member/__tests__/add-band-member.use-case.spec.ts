import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { PlanLimitExceededError } from "../../../../../plans/domain/errors/plan-limit-exceeded.error";
import { MusicianPlanTier } from "../../../../../plans/domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../../plans/domain/subscription.aggregate";
import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { SubscriptionInMemoryRepository } from "../../../../../plans/infra/db/in-memory/subscription-in-memory.repository";
import { Band } from "../../../../domain/band.aggregate";
import { Musician } from "../../../../domain/musician.aggregate";
import { BandInMemoryRepository } from "../../../../infra/db/in-memory/band-in-memory.repository";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { AddBandMemberInput } from "../add-band-member.input";
import { AddBandMemberUseCase } from "../add-band-member.use-case";

describe("AddBandMemberUseCase Unit Tests", () => {
  let useCase: AddBandMemberUseCase;
  let bandRepo: BandInMemoryRepository;
  let musicianRepo: MusicianInMemoryRepository;

  beforeEach(() => {
    bandRepo = new BandInMemoryRepository();
    musicianRepo = new MusicianInMemoryRepository();
    useCase = new AddBandMemberUseCase(bandRepo, musicianRepo);
  });

  it("should add a member to a band", async () => {
    const band = Band.fake().aBand().build();
    const musician = Musician.fake().aMusician().build();
    bandRepo.items = [band];
    musicianRepo.items = [musician];

    const input = new AddBandMemberInput({
      band_id: band.band_id.id,
      musician_id: musician.musician_id.id,
      role: "member",
      instrument: "guitar",
    });

    const output = await useCase.execute(input);

    expect(output.members).toHaveLength(1);
    expect(output.members[0]).toMatchObject({
      musician_id: musician.musician_id.id,
      role: "member",
      instrument: "guitar",
    });
    expect(bandRepo.items[0].members).toHaveLength(1);
  });

  it("should throw error when band not found", async () => {
    const musician = Musician.fake().aMusician().build();
    musicianRepo.items = [musician];

    const input = new AddBandMemberInput({
      band_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      musician_id: musician.musician_id.id,
      role: "member",
      instrument: "guitar",
    });

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("should throw error when musician not found", async () => {
    const band = Band.fake().aBand().build();
    bandRepo.items = [band];

    const input = new AddBandMemberInput({
      band_id: band.band_id.id,
      musician_id: "9366b7dc-2d71-4799-b91c-c64adb205104",
      role: "member",
      instrument: "guitar",
    });

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("should throw error when member already exists", async () => {
    const band = Band.fake().aBand().build();
    const musician = Musician.fake().aMusician().build();
    band.addMember(musician.musician_id, "member", "guitar");
    bandRepo.items = [band];
    musicianRepo.items = [musician];

    const input = new AddBandMemberInput({
      band_id: band.band_id.id,
      musician_id: musician.musician_id.id,
      role: "member",
      instrument: "bass",
    });

    await expect(useCase.execute(input)).rejects.toThrow(EntityValidationError);
  });
});

// ----------------------------------------------------------------
// Gate 4C.6 — auto_split_management
// ----------------------------------------------------------------
describe("AddBandMemberUseCase — gate 4C.6 (auto_split_management)", () => {
  function makeBandWithLeader(leaderMusician: Musician) {
    const band = Band.fake().aBand().build();
    band.addMember(leaderMusician.musician_id, "leader", "vocals");
    return band;
  }

  function makeSubscription(musicianId: string, tier: MusicianPlanTier, status = SubscriptionStatus.ACTIVE) {
    return new Subscription({
      musician_id: musicianId,
      plan_tier: tier,
      persona: "musician",
      status,
    });
  }

  async function setupWithPlan(tier?: MusicianPlanTier, cancelled = false) {
    const bandRepo = new BandInMemoryRepository();
    const musicianRepo = new MusicianInMemoryRepository();
    const subRepo = new SubscriptionInMemoryRepository();

    const leaderMusician = Musician.fake().aMusician().build();
    const newMember = Musician.fake().aMusician().build();
    const band = makeBandWithLeader(leaderMusician);

    bandRepo.items = [band];
    musicianRepo.items = [leaderMusician, newMember];

    if (tier) {
      await subRepo.insert(
        makeSubscription(
          leaderMusician.musician_id.id,
          tier,
          cancelled ? SubscriptionStatus.CANCELLED : SubscriptionStatus.ACTIVE,
        ),
      );
    }

    const planCheckService = new PlanCheckService(subRepo);
    const useCase = new AddBandMemberUseCase(bandRepo, musicianRepo, planCheckService);

    return { useCase, band, newMember };
  }

  it("(a) líder FREE: lança PlanLimitExceededError ao adicionar membro", async () => {
    const { useCase, band, newMember } = await setupWithPlan();
    const input = new AddBandMemberInput({
      band_id: band.band_id.id,
      musician_id: newMember.musician_id.id,
      role: "member",
      instrument: "guitar",
    });
    await expect(useCase.execute(input)).rejects.toThrow(PlanLimitExceededError);
  });

  it("(b) líder PRO: adiciona membro com sucesso", async () => {
    const { useCase, band, newMember } = await setupWithPlan(MusicianPlanTier.PRO);
    const input = new AddBandMemberInput({
      band_id: band.band_id.id,
      musician_id: newMember.musician_id.id,
      role: "member",
      instrument: "guitar",
    });
    const output = await useCase.execute(input);
    expect(output.members.length).toBeGreaterThan(0);
  });

  it("(c) subscription cancelada comporta-se como FREE", async () => {
    const { useCase, band, newMember } = await setupWithPlan(MusicianPlanTier.PRO, true);
    const input = new AddBandMemberInput({
      band_id: band.band_id.id,
      musician_id: newMember.musician_id.id,
      role: "member",
      instrument: "bass",
    });
    await expect(useCase.execute(input)).rejects.toThrow(PlanLimitExceededError);
  });
});
