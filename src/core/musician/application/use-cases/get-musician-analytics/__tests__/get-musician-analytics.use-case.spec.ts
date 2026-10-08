import { MusicianWallet } from "../../../../../payment/domain/musician-wallet.aggregate";
import { MusicianWalletInMemoryRepository } from "../../../../../payment/infra/db/in-memory/musician-wallet-in-memory.repository";
import { Tip } from "../../../../../payment/domain/tip.aggregate";
import { PaymentMethod } from "../../../../../payment/domain/tip-enums";
import { TipInMemoryRepository } from "../../../../../payment/infra/db/in-memory/tip-in-memory.repository";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { PlanLimitExceededError } from "../../../../../plans/domain/errors/plan-limit-exceeded.error";
import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { MusicianPlanTier } from "../../../../../plans/domain/plan-tier.enum";
import {
  Subscription,
  SubscriptionStatus,
} from "../../../../../plans/domain/subscription.aggregate";
import { SubscriptionInMemoryRepository } from "../../../../../plans/infra/db/in-memory/subscription-in-memory.repository";
import { Request } from "../../../../../request/domain/request.aggregate";
import { RequestStatus } from "../../../../../request/domain/value-objects/request-status.vo";
import { RequestInMemoryRepository } from "../../../../../request/infra/db/in-memory/request-in-memory.repository";
import { NotFoundError } from "../../../../../shared/domain/errors/not-found.error";
import { Money } from "../../../../../shared/domain/value-objects/money.vo";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import { GetMusicianAnalyticsUseCase } from "../get-musician-analytics.use-case";

async function setup(tier?: MusicianPlanTier, cancelled = false) {
  const musicianRepo = new MusicianInMemoryRepository();
  const subRepo = new SubscriptionInMemoryRepository();
  const requestRepo = new RequestInMemoryRepository();
  const walletRepo = new MusicianWalletInMemoryRepository();
  const tipRepo = new TipInMemoryRepository();

  const musician = Musician.fake().aMusician().build();
  await musicianRepo.insert(musician);

  if (tier) {
    await subRepo.insert(
      new Subscription({
        musician_id: musician.musician_id.id,
        plan_tier: tier,
        persona: "musician",
        status: cancelled
          ? SubscriptionStatus.CANCELLED
          : SubscriptionStatus.ACTIVE,
      }),
    );
  }

  const planCheckService = new PlanCheckService(subRepo);
  const useCase = new GetMusicianAnalyticsUseCase(
    musicianRepo,
    planCheckService,
    requestRepo,
    tipRepo,
  );

  return { useCase, musician, requestRepo, walletRepo, tipRepo };
}

describe("GetMusicianAnalyticsUseCase — gate 9.7a (realtime_analytics)", () => {
  // ⚠️ Este bloco mudou de sentido em 16/ago/2026 e os testes foram REESCRITOS,
  // não deletados. Até o 9.7a o gate era SOFT: o FREE recebia exatamente os
  // mesmos números do PRO e o use-case apenas devolvia `realtime_available:
  // false` junto. Os dois testes que codificavam isso ("FREE:
  // realtime_available=false" e "não lança erro para músico FREE") provavam que
  // a promessa da tabela de preços não era cumprida — por isso viraram o oposto.

  it("(a) FREE: lança PlanLimitExceededError", async () => {
    const { useCase, musician } = await setup();
    await expect(
      useCase.execute({ musician_id: musician.musician_id.id }),
    ).rejects.toThrow(PlanLimitExceededError);
  });

  it("(b) ESSENTIAL: acesso liberado, realtime_available=true", async () => {
    const { useCase, musician } = await setup(MusicianPlanTier.ESSENTIAL);
    const output = await useCase.execute({
      musician_id: musician.musician_id.id,
    });
    expect(output.realtime_available).toBe(true);
    expect(output.plan_tier).toBe(MusicianPlanTier.ESSENTIAL);
  });

  it("(b) PRO: acesso liberado, realtime_available=true", async () => {
    const { useCase, musician } = await setup(MusicianPlanTier.PRO);
    const output = await useCase.execute({
      musician_id: musician.musician_id.id,
    });
    expect(output.realtime_available).toBe(true);
  });

  it("(c) assinatura cancelada volta ao FREE e bloqueia", async () => {
    const { useCase, musician } = await setup(MusicianPlanTier.PRO, true);
    await expect(
      useCase.execute({ musician_id: musician.musician_id.id }),
    ).rejects.toThrow(PlanLimitExceededError);
  });

  it("músico inexistente continua 404, nunca 402", async () => {
    // O gate é cobrado DEPOIS do findById de propósito: trocar a ordem faria um
    // id inexistente responder "faça upgrade", que é resposta errada e ainda
    // vaza que o gate existe antes de saber se o recurso existe.
    const { useCase } = await setup();
    await expect(
      useCase.execute({ musician_id: "99999999-9999-4999-8999-999999999999" }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("GetMusicianAnalyticsUseCase — pedidos, gorjetas e músicas mais pedidas", () => {
  // Todos em PRO desde o 9.7a: o conteúdo do analytics só é alcançável em tier
  // pago. O que estes testes exercitam é a agregação, não o gate.

  it("sem pedidos e sem wallet ainda — contagens e total zerados", async () => {
    const { useCase, musician } = await setup(MusicianPlanTier.PRO);
    const output = await useCase.execute({
      musician_id: musician.musician_id.id,
    });

    expect(output.accepted_requests_count).toBe(0);
    expect(output.rejected_requests_count).toBe(0);
    expect(output.total_tips_amount).toBe(0);
    expect(output.top_requested_songs).toEqual([]);
  });

  it("conta pedidos aceitos/rejeitados e ignora pendentes de outro músico", async () => {
    const { useCase, musician, requestRepo } = await setup(
      MusicianPlanTier.PRO,
    );

    await requestRepo.insert(
      Request.fake()
        .aRequest()
        .withMusicianId(musician.musician_id)
        .withStatus(RequestStatus.accepted())
        .build(),
    );
    await requestRepo.insert(
      Request.fake()
        .aRequest()
        .withMusicianId(musician.musician_id)
        .withStatus(RequestStatus.accepted())
        .build(),
    );
    await requestRepo.insert(
      Request.fake()
        .aRequest()
        .withMusicianId(musician.musician_id)
        .withStatus(RequestStatus.rejected())
        .build(),
    );
    await requestRepo.insert(
      Request.fake()
        .aRequest()
        .withMusicianId(musician.musician_id)
        .withStatus(RequestStatus.pending())
        .build(),
    );

    const output = await useCase.execute({
      musician_id: musician.musician_id.id,
    });

    expect(output.accepted_requests_count).toBe(2);
    expect(output.rejected_requests_count).toBe(1);
  });

  it("total_tips_amount é GORJETA confirmada — o cachê liberado da carteira não entra", async () => {
    const { useCase, musician, walletRepo, tipRepo } = await setup(MusicianPlanTier.PRO);

    // A carteira soma cachê liberado em `total_earned`: era esse o número que
    // saía como "total em gorjetas" até 30/set/2026.
    await walletRepo.insert(
      MusicianWallet.fake()
        .aMusicianWallet()
        .withMusicianId(musician.musician_id)
        .withTotalEarned(new Money(1500))
        .build(),
    );

    const tip = (amount: number, to: string, completed = true) => {
      const t = Tip.create({
        audience_id: new Uuid().id,
        musician_id: to,
        amount,
        payment_method: PaymentMethod.PIX,
      });
      if (completed) t.complete(new Uuid().id);
      return tipRepo.insert(t);
    };
    await tip(0.1, musician.musician_id.id);
    await tip(0.2, musician.musician_id.id);
    await tip(100, musician.musician_id.id);
    await tip(50, musician.musician_id.id, false); // pendente não é dinheiro ainda
    await tip(999, new Uuid().id); // de outro músico

    const output = await useCase.execute({
      musician_id: musician.musician_id.id,
    });

    expect(output.total_tips_amount).toBe(100.3);
  });

  it("retorna top_requested_songs ordenado por popularidade, limitado a 5", async () => {
    const { useCase, musician, requestRepo } = await setup(
      MusicianPlanTier.PRO,
    );

    for (let i = 0; i < 3; i++) {
      await requestRepo.insert(
        Request.fake()
          .aRequest()
          .withMusicianId(musician.musician_id)
          .withSongTitle("Evidências")
          .withArtist("Chitãozinho & Xororó")
          .build(),
      );
    }
    await requestRepo.insert(
      Request.fake()
        .aRequest()
        .withMusicianId(musician.musician_id)
        .withSongTitle("Trem-Bala")
        .withArtist("Ana Vilela")
        .build(),
    );

    const output = await useCase.execute({
      musician_id: musician.musician_id.id,
    });

    expect(output.top_requested_songs[0]).toEqual({
      song_title: "Evidências",
      artist: "Chitãozinho & Xororó",
      count: 3,
    });
    expect(output.top_requested_songs.length).toBeLessThanOrEqual(5);
  });
});
