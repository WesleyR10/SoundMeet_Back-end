import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  COMING_SOON_ESTABLISHMENT_FEATURES,
  COMING_SOON_MUSICIAN_FEATURES,
  ESTABLISHMENT_PLAN_FEATURES,
  ESTABLISHMENT_PLAN_PRICING,
  EstablishmentPlanFeatures,
  MUSICIAN_PLAN_FEATURES,
  MUSICIAN_PLAN_PRICING,
  MusicianPlanFeatures,
  PlanPricing,
} from "../../../domain/plan-features.config";
import {
  EstablishmentPlanTier,
  MusicianPlanTier,
} from "../../../domain/plan-tier.enum";

export type ListPlansInput = Record<string, never>;

export type PlanCatalogEntry<TFeatures> = {
  tier: string;
  pricing: PlanPricing;
  features: TFeatures;
};

/**
 * 🔴 Campos internos de antifraude — NUNCA saem no catálogo público (`@Public()`).
 *
 * Revelar o teto de saque e o velocity exatos entregaria a um atacante o mapa
 * para drenar logo abaixo do limite. O músico legítimo não precisa deles aqui:
 * o limite que importa a ele volta escopado na resposta do próprio saque. Novo
 * campo sensível → some para esta lista, senão vaza por herança do spread.
 */
const MUSICIAN_SECURITY_FEATURES = [
  "max_withdrawal_per_day_brl",
  "max_withdrawals_per_day",
] as const;

export type PublicMusicianPlanFeatures = Omit<
  MusicianPlanFeatures,
  (typeof MUSICIAN_SECURITY_FEATURES)[number]
>;

function toPublicMusicianFeatures(
  features: MusicianPlanFeatures,
): PublicMusicianPlanFeatures {
  const clone: Record<string, unknown> = { ...features };
  for (const key of MUSICIAN_SECURITY_FEATURES) {
    delete clone[key];
  }
  return clone as PublicMusicianPlanFeatures;
}

export type ListPlansOutput = {
  musician: PlanCatalogEntry<PublicMusicianPlanFeatures>[];
  establishment: PlanCatalogEntry<EstablishmentPlanFeatures>[];
  /**
   * Features presentes em `features` que ainda NÃO existem como capacidade —
   * decisão 9.7a. A UI é obrigada a renderizá-las como "em breve"; mostrá-las
   * como incluídas no tier é a promessa falsa que este bloco veio corrigir.
   */
  coming_soon: {
    musician: string[];
    establishment: string[];
  };
};

/**
 * Catálogo público de planos — fonte única: plan-features.config.ts.
 * Substitui o espelho hardcoded que o mobile mantinha em plans.config.ts.
 */
export class ListPlansUseCase implements IUseCase<
  ListPlansInput,
  ListPlansOutput
> {
  async execute(): Promise<ListPlansOutput> {
    return {
      musician: Object.values(MusicianPlanTier).map((tier) => ({
        tier,
        pricing: MUSICIAN_PLAN_PRICING[tier],
        features: toPublicMusicianFeatures(MUSICIAN_PLAN_FEATURES[tier]),
      })),
      establishment: Object.values(EstablishmentPlanTier).map((tier) => ({
        tier,
        pricing: ESTABLISHMENT_PLAN_PRICING[tier],
        features: ESTABLISHMENT_PLAN_FEATURES[tier],
      })),
      coming_soon: {
        musician: [...COMING_SOON_MUSICIAN_FEATURES],
        establishment: [...COMING_SOON_ESTABLISHMENT_FEATURES],
      },
    };
  }
}
