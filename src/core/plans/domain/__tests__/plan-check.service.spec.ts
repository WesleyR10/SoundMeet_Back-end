import { PlanLimitExceededError } from "../errors/plan-limit-exceeded.error";
import { EstablishmentPlanTier, MusicianPlanTier } from "../plan-tier.enum";
import { PlanCheckService } from "../plan-check.service";
import {
  Subscription,
  SubscriptionStatus,
} from "../subscription.aggregate";
import { SubscriptionInMemoryRepository } from "../../infra/db/in-memory/subscription-in-memory.repository";

const MUSICIAN_ID = "musician-uuid-001";
const ESTABLISHMENT_ID = "establishment-uuid-001";

function makeRepo(): SubscriptionInMemoryRepository {
  return new SubscriptionInMemoryRepository();
}

function makeMusicianSub(musician_id: string, tier: MusicianPlanTier) {
  return new Subscription({
    musician_id,
    plan_tier: tier,
    persona: "musician",
    status: SubscriptionStatus.ACTIVE,
  });
}

function makeEstablishmentSub(
  establishment_id: string,
  tier: EstablishmentPlanTier,
) {
  return new Subscription({
    establishment_id,
    plan_tier: tier,
    persona: "establishment",
    status: SubscriptionStatus.ACTIVE,
  });
}

describe("PlanCheckService", () => {
  // ----------------------------------------------------------------
  // Tier lookup — músico
  // ----------------------------------------------------------------
  describe("getMusicianPlanTier", () => {
    it("retorna FREE quando não há subscription ativa", async () => {
      const service = new PlanCheckService(makeRepo());
      expect(await service.getMusicianPlanTier(MUSICIAN_ID)).toBe(
        MusicianPlanTier.FREE,
      );
    });

    it("retorna ESSENTIAL quando há subscription ESSENTIAL ativa", async () => {
      const repo = makeRepo();
      await repo.insert(makeMusicianSub(MUSICIAN_ID, MusicianPlanTier.ESSENTIAL));
      const service = new PlanCheckService(repo);
      expect(await service.getMusicianPlanTier(MUSICIAN_ID)).toBe(
        MusicianPlanTier.ESSENTIAL,
      );
    });

    it("retorna PRO quando há subscription PRO ativa", async () => {
      const repo = makeRepo();
      await repo.insert(makeMusicianSub(MUSICIAN_ID, MusicianPlanTier.PRO));
      const service = new PlanCheckService(repo);
      expect(await service.getMusicianPlanTier(MUSICIAN_ID)).toBe(
        MusicianPlanTier.PRO,
      );
    });

    it("subscription cancelada → tier FREE (fail-safe)", async () => {
      const repo = makeRepo();
      const sub = makeMusicianSub(MUSICIAN_ID, MusicianPlanTier.ESSENTIAL);
      sub.cancel();
      await repo.insert(sub);
      const service = new PlanCheckService(repo);
      expect(await service.getMusicianPlanTier(MUSICIAN_ID)).toBe(
        MusicianPlanTier.FREE,
      );
    });
  });

  // ----------------------------------------------------------------
  // Tier lookup — estabelecimento
  // ----------------------------------------------------------------
  describe("getEstablishmentPlanTier", () => {
    it("retorna FREE quando não há subscription ativa", async () => {
      const service = new PlanCheckService(makeRepo());
      expect(
        await service.getEstablishmentPlanTier(ESTABLISHMENT_ID),
      ).toBe(EstablishmentPlanTier.FREE);
    });

    it("retorna GROWTH quando há subscription GROWTH ativa", async () => {
      const repo = makeRepo();
      await repo.insert(
        makeEstablishmentSub(ESTABLISHMENT_ID, EstablishmentPlanTier.GROWTH),
      );
      const service = new PlanCheckService(repo);
      expect(
        await service.getEstablishmentPlanTier(ESTABLISHMENT_ID),
      ).toBe(EstablishmentPlanTier.GROWTH);
    });
  });

  // ----------------------------------------------------------------
  // Taxa de gorjeta
  // ----------------------------------------------------------------
  describe("getMusicianTipFeePercentage", () => {
    it("retorna 9% para músico FREE", async () => {
      const service = new PlanCheckService(makeRepo());
      expect(await service.getMusicianTipFeePercentage(MUSICIAN_ID)).toBe(9);
    });

    it("retorna 7% para músico ESSENTIAL", async () => {
      const repo = makeRepo();
      await repo.insert(makeMusicianSub(MUSICIAN_ID, MusicianPlanTier.ESSENTIAL));
      const service = new PlanCheckService(repo);
      expect(await service.getMusicianTipFeePercentage(MUSICIAN_ID)).toBe(7);
    });

    it("retorna 5% para músico PRO", async () => {
      const repo = makeRepo();
      await repo.insert(makeMusicianSub(MUSICIAN_ID, MusicianPlanTier.PRO));
      const service = new PlanCheckService(repo);
      expect(await service.getMusicianTipFeePercentage(MUSICIAN_ID)).toBe(5);
    });

    it("subscription cancelada → 9% (FREE)", async () => {
      const repo = makeRepo();
      const sub = makeMusicianSub(MUSICIAN_ID, MusicianPlanTier.PRO);
      sub.cancel();
      await repo.insert(sub);
      const service = new PlanCheckService(repo);
      expect(await service.getMusicianTipFeePercentage(MUSICIAN_ID)).toBe(9);
    });
  });

  // ----------------------------------------------------------------
  // Configuração de saque
  // ----------------------------------------------------------------
  describe("getMusicianWithdrawalConfig", () => {
    it("FREE → R$110 mínimo, 5 dias úteis", async () => {
      const service = new PlanCheckService(makeRepo());
      const config = await service.getMusicianWithdrawalConfig(MUSICIAN_ID);
      expect(config.min_amount_brl).toBe(110);
      expect(config.days).toBe(5);
    });

    it("ESSENTIAL → R$70 mínimo, 3 dias úteis", async () => {
      const repo = makeRepo();
      await repo.insert(makeMusicianSub(MUSICIAN_ID, MusicianPlanTier.ESSENTIAL));
      const service = new PlanCheckService(repo);
      const config = await service.getMusicianWithdrawalConfig(MUSICIAN_ID);
      expect(config.min_amount_brl).toBe(70);
      expect(config.days).toBe(3);
    });

    it("PRO → R$50 mínimo, 1 dia (até 24h)", async () => {
      const repo = makeRepo();
      await repo.insert(makeMusicianSub(MUSICIAN_ID, MusicianPlanTier.PRO));
      const service = new PlanCheckService(repo);
      const config = await service.getMusicianWithdrawalConfig(MUSICIAN_ID);
      expect(config.min_amount_brl).toBe(50);
      expect(config.days).toBe(1);
    });
  });

  // ----------------------------------------------------------------
  // Feature gate — músico (booleano)
  // ----------------------------------------------------------------
  describe("assertMusicianFeature", () => {
    it("FREE → analytics bloqueado", async () => {
      const service = new PlanCheckService(makeRepo());
      await expect(
        service.assertMusicianFeature(MUSICIAN_ID, "realtime_analytics"),
      ).rejects.toThrow(PlanLimitExceededError);
    });

    it("ESSENTIAL → analytics liberado", async () => {
      const repo = makeRepo();
      await repo.insert(makeMusicianSub(MUSICIAN_ID, MusicianPlanTier.ESSENTIAL));
      const service = new PlanCheckService(repo);
      await expect(
        service.assertMusicianFeature(MUSICIAN_ID, "realtime_analytics"),
      ).resolves.not.toThrow();
    });

    it("FREE → QR customizado bloqueado", async () => {
      const service = new PlanCheckService(makeRepo());
      await expect(
        service.assertMusicianFeature(MUSICIAN_ID, "custom_qr_code"),
      ).rejects.toThrow(PlanLimitExceededError);
    });

    it("PRO → QR customizado liberado", async () => {
      const repo = makeRepo();
      await repo.insert(makeMusicianSub(MUSICIAN_ID, MusicianPlanTier.PRO));
      const service = new PlanCheckService(repo);
      await expect(
        service.assertMusicianFeature(MUSICIAN_ID, "custom_qr_code"),
      ).resolves.not.toThrow();
    });

    it("PRO → auto_split_management liberado", async () => {
      const repo = makeRepo();
      await repo.insert(makeMusicianSub(MUSICIAN_ID, MusicianPlanTier.PRO));
      const service = new PlanCheckService(repo);
      await expect(
        service.assertMusicianFeature(MUSICIAN_ID, "auto_split_management"),
      ).resolves.not.toThrow();
    });
  });

  // ----------------------------------------------------------------
  // Feature gate — estabelecimento (booleano)
  // ----------------------------------------------------------------
  describe("assertEstablishmentFeature", () => {
    it("FREE → campanhas bloqueadas", async () => {
      const service = new PlanCheckService(makeRepo());
      await expect(
        service.assertEstablishmentFeature(
          ESTABLISHMENT_ID,
          "promotional_campaigns",
        ),
      ).rejects.toThrow(PlanLimitExceededError);
    });

    it("GROWTH → campanhas liberadas", async () => {
      const repo = makeRepo();
      await repo.insert(
        makeEstablishmentSub(ESTABLISHMENT_ID, EstablishmentPlanTier.GROWTH),
      );
      const service = new PlanCheckService(repo);
      await expect(
        service.assertEstablishmentFeature(
          ESTABLISHMENT_ID,
          "promotional_campaigns",
        ),
      ).resolves.not.toThrow();
    });

    it("FREE → multi-estabelecimento bloqueado", async () => {
      const service = new PlanCheckService(makeRepo());
      await expect(
        service.assertEstablishmentFeature(
          ESTABLISHMENT_ID,
          "multi_establishment",
        ),
      ).rejects.toThrow(PlanLimitExceededError);
    });

    it("PRO → multi-estabelecimento liberado", async () => {
      const repo = makeRepo();
      await repo.insert(
        makeEstablishmentSub(ESTABLISHMENT_ID, EstablishmentPlanTier.PRO),
      );
      const service = new PlanCheckService(repo);
      await expect(
        service.assertEstablishmentFeature(
          ESTABLISHMENT_ID,
          "multi_establishment",
        ),
      ).resolves.not.toThrow();
    });
  });

  // ----------------------------------------------------------------
  // Banner generation
  // ----------------------------------------------------------------
  describe("assertMusicianCanGenerateBanner", () => {
    it("FREE → bloqueia por indisponibilidade", async () => {
      const service = new PlanCheckService(makeRepo());
      await expect(
        service.assertMusicianCanGenerateBanner(MUSICIAN_ID, 0),
      ).rejects.toThrow(PlanLimitExceededError);
    });

    it("ESSENTIAL → permite dentro do limite (2 de 3)", async () => {
      const repo = makeRepo();
      await repo.insert(makeMusicianSub(MUSICIAN_ID, MusicianPlanTier.ESSENTIAL));
      const service = new PlanCheckService(repo);
      await expect(
        service.assertMusicianCanGenerateBanner(MUSICIAN_ID, 2),
      ).resolves.not.toThrow();
    });

    it("ESSENTIAL → bloqueia ao atingir limite (3 de 3)", async () => {
      const repo = makeRepo();
      await repo.insert(makeMusicianSub(MUSICIAN_ID, MusicianPlanTier.ESSENTIAL));
      const service = new PlanCheckService(repo);
      await expect(
        service.assertMusicianCanGenerateBanner(MUSICIAN_ID, 3),
      ).rejects.toThrow(PlanLimitExceededError);
    });

    it("PRO → permite qualquer quantidade (15/mês)", async () => {
      const repo = makeRepo();
      await repo.insert(makeMusicianSub(MUSICIAN_ID, MusicianPlanTier.PRO));
      const service = new PlanCheckService(repo);
      await expect(
        service.assertMusicianCanGenerateBanner(MUSICIAN_ID, 14),
      ).resolves.not.toThrow();
    });
  });
});
