import { PlanLimitExceededError } from "../../../../../plans/domain/errors/plan-limit-exceeded.error";
import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { MusicianPlanTier } from "../../../../../plans/domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../../plans/domain/subscription.aggregate";
import { SubscriptionInMemoryRepository } from "../../../../../plans/infra/db/in-memory/subscription-in-memory.repository";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
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
        status: cancelled
          ? SubscriptionStatus.CANCELLED
          : SubscriptionStatus.ACTIVE,
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

  /*
   * Remover o logo (`logo_url: null`) também apaga o arquivo. Antes só a URL
   * saía do perfil e o objeto ficava no bucket.
   */
  describe("remoção do logo", () => {
    async function setupWithLogo() {
      const musicianRepo = new MusicianInMemoryRepository();
      const subRepo = new SubscriptionInMemoryRepository();
      const musician = Musician.fake().aMusician().build();
      musician.generateQRCode();
      musician.changeQrLogo("https://cdn.test/qr/l1.png", "qr-logos/x/l1.png");
      await musicianRepo.insert(musician);
      await subRepo.insert(
        new Subscription({
          musician_id: musician.musician_id.id,
          plan_tier: MusicianPlanTier.PRO,
          persona: "musician",
          status: SubscriptionStatus.ACTIVE,
        }),
      );
      const storage = {
        putObject: jest.fn(),
        deleteObject: jest.fn().mockResolvedValue(undefined),
        getPublicUrl: jest.fn(),
      };
      const useCase = new CustomizeQRCodeUseCase(
        musicianRepo,
        new PlanCheckService(subRepo),
        storage,
      );
      return { useCase, musician, storage, musicianRepo };
    }

    it("logo_url: null apaga o objeto e solta a chave", async () => {
      const { useCase, musician, storage, musicianRepo } =
        await setupWithLogo();

      const output = await useCase.execute({
        musician_id: musician.musician_id.id,
        customization: { logo_url: null },
      });

      expect(storage.deleteObject).toHaveBeenCalledWith({
        object_key: "qr-logos/x/l1.png",
      });
      expect(output.qr_customization?.logo_url).toBeUndefined();
      expect(
        (await musicianRepo.findById(musician.musician_id))!.qr_logo_key,
      ).toBeNull();
    });

    it("mexer só na cor não apaga logo nenhum", async () => {
      const { useCase, musician, storage } = await setupWithLogo();

      await useCase.execute({
        musician_id: musician.musician_id.id,
        customization: { foreground_color: "#000000" },
      });

      expect(storage.deleteObject).not.toHaveBeenCalled();
    });

    it("falha do bucket não derruba a customização", async () => {
      const { useCase, musician, storage } = await setupWithLogo();
      storage.deleteObject.mockRejectedValueOnce(new Error("bucket fora"));

      await expect(
        useCase.execute({
          musician_id: musician.musician_id.id,
          customization: { logo_url: null },
        }),
      ).resolves.toBeDefined();
    });
  });
});
