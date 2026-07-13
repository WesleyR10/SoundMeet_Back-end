import { PlanLimitExceededError } from "../../../../../plans/domain/errors/plan-limit-exceeded.error";
import { MusicianPlanTier } from "../../../../../plans/domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../../plans/domain/subscription.aggregate";
import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { SubscriptionInMemoryRepository } from "../../../../../plans/infra/db/in-memory/subscription-in-memory.repository";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { Musician } from "../../../../domain/musician.aggregate";
import { CustomizeQRCodeUseCase } from "../customize-qr-code.use-case";

async function setup(tier?: MusicianPlanTier, cancelled = false) {
  const musicianRepo = new MusicianInMemoryRepository();
  const subRepo = new SubscriptionInMemoryRepository();

  const musician = Musician.fake().aMusician().build();
  const musicianId = musician.musician_id.id;

  musician.generateQRCode();
  await musicianRepo.insert(musician);

  if (tier) {
    await subRepo.insert(
      new Subscription({
        musician_id: musicianId,
        plan_tier: tier,
        persona: "musician",
        status: cancelled ? SubscriptionStatus.CANCELLED : SubscriptionStatus.ACTIVE,
      }),
    );
  }

  const planCheckService = new PlanCheckService(subRepo);
  const useCase = new CustomizeQRCodeUseCase(musicianRepo, planCheckService);

  return { useCase, musician };
}

describe("CustomizeQRCodeUseCase — gate 4C.4", () => {
  it("(a) FREE: lança PlanLimitExceededError ao tentar personalizar QR Code", async () => {
    const { useCase, musician } = await setup();
    await expect(
      useCase.execute({
        musician_id: musician.musician_id.id,
        customization: { foreground_color: "#000000" },
      }),
    ).rejects.toThrow(PlanLimitExceededError);
  });

  it("(b) PRO: personaliza QR Code com sucesso", async () => {
    const { useCase, musician } = await setup(MusicianPlanTier.PRO);
    await expect(
      useCase.execute({
        musician_id: musician.musician_id.id,
        customization: { foreground_color: "#1a1a2e", label: "Minha Banda" },
      }),
    ).resolves.not.toThrow();
  });

  it("(c) subscription cancelada comporta-se como FREE", async () => {
    const { useCase, musician } = await setup(MusicianPlanTier.PRO, true);
    await expect(
      useCase.execute({
        musician_id: musician.musician_id.id,
        customization: { logo_url: "https://cdn.example.com/logo.png" },
      }),
    ).rejects.toThrow(PlanLimitExceededError);
  });

  it("(d) customizar só o label depois de já ter cor/logo preserva ambos (merge, não substituição)", async () => {
    const { useCase, musician } = await setup(MusicianPlanTier.PRO);

    await useCase.execute({
      musician_id: musician.musician_id.id,
      customization: {
        foreground_color: "#1a1a2e",
        logo_url: "https://cdn.example.com/logo.png",
      },
    });

    const output = await useCase.execute({
      musician_id: musician.musician_id.id,
      customization: { label: "Peça uma música!" },
    });

    expect(output.qr_customization).toEqual({
      foreground_color: "#1a1a2e",
      logo_url: "https://cdn.example.com/logo.png",
      label: "Peça uma música!",
    });
  });

  it("(e) customization: null remove só aquela chave, preservando as demais (reset ao padrão)", async () => {
    const { useCase, musician } = await setup(MusicianPlanTier.PRO);

    await useCase.execute({
      musician_id: musician.musician_id.id,
      customization: {
        foreground_color: "#1a1a2e",
        background_color: "#ffffff",
        logo_url: "https://cdn.example.com/logo.png",
        label: "Peça uma música!",
      },
    });

    const output = await useCase.execute({
      musician_id: musician.musician_id.id,
      customization: { foreground_color: null, logo_url: null },
    });

    expect(output.qr_customization).toEqual({
      background_color: "#ffffff",
      label: "Peça uma música!",
    });
  });

  it("(f) rejeita cores de contraste insuficiente (QR ficaria ilegível)", async () => {
    const { useCase, musician } = await setup(MusicianPlanTier.PRO);

    await expect(
      useCase.execute({
        musician_id: musician.musician_id.id,
        customization: {
          foreground_color: "#1a1a2e",
          background_color: "#1a1a2e",
        },
      }),
    ).rejects.toThrow(/contraste insuficiente/);
  });
});
