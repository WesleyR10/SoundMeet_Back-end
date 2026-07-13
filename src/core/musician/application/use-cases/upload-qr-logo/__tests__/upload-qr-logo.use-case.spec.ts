import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
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
import { IMusicianStorage } from "../../../ports/musician-storage.interface";
import { UploadQrLogoUseCase } from "../upload-qr-logo.use-case";

function makeStorage(): jest.Mocked<IMusicianStorage> {
  return {
    putObject: jest.fn().mockResolvedValue(undefined),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    getPublicUrl: jest
      .fn()
      .mockImplementation((key: string) => `https://cdn.test/${key}`),
  };
}

async function setup(tier?: MusicianPlanTier) {
  const repo = new MusicianInMemoryRepository();
  const subRepo = new SubscriptionInMemoryRepository();
  const storage = makeStorage();

  const musician = Musician.fake().aMusician().build();
  musician.generateQRCode();
  await repo.insert(musician);

  if (tier) {
    await subRepo.insert(
      new Subscription({
        musician_id: musician.musician_id.id,
        plan_tier: tier,
        persona: "musician",
        status: SubscriptionStatus.ACTIVE,
      }),
    );
  }

  const planCheckService = new PlanCheckService(subRepo);
  const useCase = new UploadQrLogoUseCase(repo, storage, planCheckService);

  return { useCase, musician, repo, storage };
}

describe("UploadQrLogoUseCase Unit Tests", () => {
  it("FREE: lança PlanLimitExceededError e não chega a subir o arquivo", async () => {
    const { useCase, musician, storage } = await setup();

    await expect(
      useCase.execute({
        musician_id: musician.musician_id.id,
        data: Buffer.from("fake-image-bytes"),
        content_type: "image/jpeg",
        file_size: 1024,
      }),
    ).rejects.toThrow(PlanLimitExceededError);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("PRO: sobe o logo e aplica via customizeQRCode (merge, preserva cor já setada)", async () => {
    const { useCase, musician, repo, storage } = await setup(
      MusicianPlanTier.PRO,
    );
    musician.customizeQRCode({ foreground_color: "#1a1a2e" });
    await repo.update(musician);

    const output = await useCase.execute({
      musician_id: musician.musician_id.id,
      data: Buffer.from("fake-image-bytes"),
      content_type: "image/jpeg",
      file_size: 1024,
    });

    expect(storage.putObject).toHaveBeenCalledTimes(1);
    const objectKey = storage.putObject.mock.calls[0][0].object_key as string;
    expect(objectKey).toMatch(
      new RegExp(`^qr-logos/${musician.musician_id.id}/.+\\.jpg$`),
    );
    expect(output.qr_customization).toEqual({
      foreground_color: "#1a1a2e",
      logo_url: `https://cdn.test/${objectKey}`,
    });

    const updated = await repo.findById(musician.musician_id);
    expect(updated?.qr_code?.customization?.logo_url).toBe(
      `https://cdn.test/${objectKey}`,
    );
  });

  it("throws NotFoundError when the musician does not exist", async () => {
    // Gate de plano roda antes da busca do agregado (mesma ordem de
    // CustomizeQRCodeUseCase) — pra provar NotFoundError isoladamente,
    // precisa de uma assinatura PRO associada ao id inexistente, senão o
    // gate rejeita primeiro (id sem assinatura = FREE por padrão).
    const { repo, storage } = await setup();
    const bogusId = "8a746e1c-4f2a-4a1b-9c8e-1a2b3c4d5e6f";
    const subRepo = new SubscriptionInMemoryRepository();
    await subRepo.insert(
      new Subscription({
        musician_id: bogusId,
        plan_tier: MusicianPlanTier.PRO,
        persona: "musician",
        status: SubscriptionStatus.ACTIVE,
      }),
    );
    const useCaseWithBogusSub = new UploadQrLogoUseCase(
      repo,
      storage,
      new PlanCheckService(subRepo),
    );

    await expect(
      useCaseWithBogusSub.execute({
        musician_id: bogusId,
        data: Buffer.from("x"),
        content_type: "image/jpeg",
        file_size: 1024,
      }),
    ).rejects.toThrow(NotFoundError);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("throws EntityValidationError when content type is not allowed", async () => {
    const { useCase, musician, storage } = await setup(MusicianPlanTier.PRO);

    await expect(
      useCase.execute({
        musician_id: musician.musician_id.id,
        data: Buffer.from("x"),
        content_type: "application/pdf",
        file_size: 1024,
      }),
    ).rejects.toThrow(EntityValidationError);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("throws EntityValidationError when file exceeds the maximum size", async () => {
    const { useCase, musician, storage } = await setup(MusicianPlanTier.PRO);

    await expect(
      useCase.execute({
        musician_id: musician.musician_id.id,
        data: Buffer.from("x"),
        content_type: "image/png",
        file_size: 3 * 1024 * 1024,
      }),
    ).rejects.toThrow(EntityValidationError);
    expect(storage.putObject).not.toHaveBeenCalled();
  });
});
