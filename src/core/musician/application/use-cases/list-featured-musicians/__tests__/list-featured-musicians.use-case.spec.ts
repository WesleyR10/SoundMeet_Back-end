import { PlanCheckService } from "../../../../../plans/domain/plan-check.service";
import { MusicianPlanTier } from "../../../../../plans/domain/plan-tier.enum";
import { Subscription } from "../../../../../plans/domain/subscription.aggregate";
import { SubscriptionInMemoryRepository } from "../../../../../plans/infra/db/in-memory/subscription-in-memory.repository";
import { Musician } from "../../../../domain/musician.aggregate";
import { MusicianInMemoryRepository } from "../../../../infra/db/in-memory/musician-in-memory.repository";
import {
  FEATURED_MUSICIANS_MAX,
  ListFeaturedMusiciansUseCase,
} from "../list-featured-musicians.use-case";

describe("ListFeaturedMusiciansUseCase Unit Tests", () => {
  let useCase: ListFeaturedMusiciansUseCase;
  let musicianRepo: MusicianInMemoryRepository;
  let subscriptionRepo: SubscriptionInMemoryRepository;

  beforeEach(() => {
    musicianRepo = new MusicianInMemoryRepository();
    subscriptionRepo = new SubscriptionInMemoryRepository();
    useCase = new ListFeaturedMusiciansUseCase(
      musicianRepo,
      new PlanCheckService(subscriptionRepo),
    );
  });

  /**
   * Músico visível na busca: consentiu e está ativo.
   *
   * ⚠️ A nota entra por `syncRatingProjection`, não pelo fake builder: o
   * builder NÃO tem `withRating` — `rating` é projeção, escrita a partir do
   * ledger de avaliações, e é assim que o seed também faz.
   */
  const aVisibleMusician = (rating: number, openToGigs: boolean | null = true) => {
    const musician = Musician.fake()
      .aMusician()
      .withOpenToGigs(openToGigs)
      .activate()
      .build();
    musician.syncRatingProjection(rating, 5);
    return musician;
  };

  const subscribe = async (
    musician: Musician,
    tier: MusicianPlanTier,
    opts: { trial?: boolean; cancel?: boolean; expire?: boolean } = {},
  ) => {
    const sub = Subscription.create({
      musician_id: musician.musician_id.id,
      plan_tier: tier,
      persona: "musician",
      ...(opts.trial
        ? { trial_ends_at: new Date(Date.now() + 7 * 864e5) }
        : {}),
    });
    if (opts.cancel) sub.cancel();
    if (opts.expire) sub.expire();
    await subscriptionRepo.insert(sub);
    return sub;
  };

  it("devolve vazio quando ninguém assina — é estado NORMAL, não falha", async () => {
    await musicianRepo.bulkInsert([
      aVisibleMusician(4.8),
      aVisibleMusician(4.2),
    ]);

    const output = await useCase.execute({});

    // 🔴 Nunca cai para artistas orgânicos: preencher a faixa com quem não
    // pagou entregaria de graça exatamente o que é o produto.
    expect(output.items).toEqual([]);
  });

  it("inclui ESSENTIAL e PRO, e trial conta como vigente", async () => {
    const essential = aVisibleMusician(3.6);
    const pro = aVisibleMusician(4.2);
    const proTrial = aVisibleMusician(5.0);
    await musicianRepo.bulkInsert([essential, pro, proTrial]);
    await subscribe(essential, MusicianPlanTier.ESSENTIAL);
    await subscribe(pro, MusicianPlanTier.PRO);
    await subscribe(proTrial, MusicianPlanTier.PRO, { trial: true });

    const output = await useCase.execute({});

    expect(output.items).toHaveLength(3);
  });

  it("🔴 ordena por nota DESC — a vitrine paga não pode abrir com o pior", async () => {
    const pior = aVisibleMusician(3.6);
    const meio = aVisibleMusician(4.2);
    const melhor = aVisibleMusician(5.0);
    await musicianRepo.bulkInsert([pior, meio, melhor]);
    for (const m of [pior, meio, melhor]) {
      await subscribe(m, MusicianPlanTier.PRO);
    }

    const output = await useCase.execute({});

    expect(output.items.map((i) => i.rating)).toEqual([5, 4.2, 3.6]);
  });

  it("🔴 assinante que NÃO consentiu não aparece — pagar não substitui consentir", async () => {
    const semConsentimento = aVisibleMusician(5, false);
    const naoDecidiu = aVisibleMusician(5, null);
    const consentiu = aVisibleMusician(3.0);
    await musicianRepo.bulkInsert([semConsentimento, naoDecidiu, consentiu]);
    for (const m of [semConsentimento, naoDecidiu, consentiu]) {
      await subscribe(m, MusicianPlanTier.PRO);
    }

    const output = await useCase.execute({});

    expect(output.items).toHaveLength(1);
    expect(output.items[0].id).toBe(consentiu.musician_id.id);
  });

  it("assinatura cancelada ou vencida não dá destaque", async () => {
    const cancelado = aVisibleMusician(5);
    const vencido = aVisibleMusician(5);
    await musicianRepo.bulkInsert([cancelado, vencido]);
    await subscribe(cancelado, MusicianPlanTier.PRO, { cancel: true });
    await subscribe(vencido, MusicianPlanTier.ESSENTIAL, { expire: true });

    const output = await useCase.execute({});

    expect(output.items).toEqual([]);
  });

  it("🔴 linha órfã de FREE não compra destaque de graça", async () => {
    // O seed afirma que tier gratuito não gera linha, mas `plan_tier` é uma
    // coluna String sem constraint — a invariante vive numa convenção.
    const free = aVisibleMusician(5);
    await musicianRepo.insert(free);
    await subscribe(free, MusicianPlanTier.FREE);

    const output = await useCase.execute({});

    expect(output.items).toEqual([]);
  });

  it(`clampa o limite em ${FEATURED_MUSICIANS_MAX}, mesmo pedindo mais`, async () => {
    const muitos = Array.from({ length: 6 }, (_, i) =>
      aVisibleMusician(5 - i * 0.1),
    );
    await musicianRepo.bulkInsert(muitos);
    for (const m of muitos) await subscribe(m, MusicianPlanTier.PRO);

    const semLimite = await useCase.execute({});
    const pedindo99 = await useCase.execute({ limit: 99 });
    const pedindoUm = await useCase.execute({ limit: 1 });

    expect(semLimite.items).toHaveLength(FEATURED_MUSICIANS_MAX);
    expect(pedindo99.items).toHaveLength(FEATURED_MUSICIANS_MAX);
    expect(pedindoUm.items).toHaveLength(1);
  });

  it("limite zero ou negativo não zera a faixa — clampa em 1", async () => {
    const pro = aVisibleMusician(5);
    await musicianRepo.insert(pro);
    await subscribe(pro, MusicianPlanTier.PRO);

    expect((await useCase.execute({ limit: 0 })).items).toHaveLength(1);
    expect((await useCase.execute({ limit: -5 })).items).toHaveLength(1);
  });

  it("não devolve quem não assina, mesmo com nota melhor", async () => {
    const freeEstrela = aVisibleMusician(5.0);
    const pagante = aVisibleMusician(2.0);
    await musicianRepo.bulkInsert([freeEstrela, pagante]);
    await subscribe(pagante, MusicianPlanTier.ESSENTIAL);

    const output = await useCase.execute({});

    expect(output.items).toHaveLength(1);
    expect(output.items[0].id).toBe(pagante.musician_id.id);
  });
});
