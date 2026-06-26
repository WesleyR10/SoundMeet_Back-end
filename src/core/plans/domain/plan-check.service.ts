import { PlanLimitExceededError } from "./errors/plan-limit-exceeded.error";
import {
  ESTABLISHMENT_PLAN_FEATURES,
  EstablishmentPlanFeatures,
  MUSICIAN_PLAN_FEATURES,
  MusicianPlanFeatures,
} from "./plan-features.config";
import {
  EstablishmentPlanTier,
  MusicianPlanTier,
} from "./plan-tier.enum";
import { ISubscriptionRepository } from "./subscription.repository";

export class PlanCheckService {
  constructor(
    private readonly subscriptionRepository: ISubscriptionRepository,
  ) {}

  async getMusicianPlanTier(musician_id: string): Promise<MusicianPlanTier> {
    const sub =
      await this.subscriptionRepository.findActiveMusicianSubscription(
        musician_id,
      );
    if (!sub || !sub.isActive()) return MusicianPlanTier.FREE;
    return (sub.plan_tier as MusicianPlanTier) ?? MusicianPlanTier.FREE;
  }

  async getMusicianFeatures(musician_id: string): Promise<MusicianPlanFeatures> {
    const tier = await this.getMusicianPlanTier(musician_id);
    return MUSICIAN_PLAN_FEATURES[tier] ?? MUSICIAN_PLAN_FEATURES[MusicianPlanTier.FREE];
  }

  async getEstablishmentPlanTier(
    establishment_id: string,
  ): Promise<EstablishmentPlanTier> {
    const sub =
      await this.subscriptionRepository.findActiveEstablishmentSubscription(
        establishment_id,
      );
    if (!sub || !sub.isActive()) return EstablishmentPlanTier.FREE;
    return (
      (sub.plan_tier as EstablishmentPlanTier) ?? EstablishmentPlanTier.FREE
    );
  }

  async getEstablishmentFeatures(
    establishment_id: string,
  ): Promise<EstablishmentPlanFeatures> {
    const tier = await this.getEstablishmentPlanTier(establishment_id);
    return ESTABLISHMENT_PLAN_FEATURES[tier] ?? ESTABLISHMENT_PLAN_FEATURES[EstablishmentPlanTier.FREE];
  }

  /** Retorna o percentual de taxa da plataforma sobre gorjetas (ex.: 9 = 9%). */
  async getMusicianTipFeePercentage(musician_id: string): Promise<number> {
    const features = await this.getMusicianFeatures(musician_id);
    return features.tip_fee_percentage;
  }

  /** Retorna configuração de saque do músico com base no plano ativo. */
  async getMusicianWithdrawalConfig(
    musician_id: string,
  ): Promise<{ min_amount_brl: number; days: number }> {
    const features = await this.getMusicianFeatures(musician_id);
    return {
      min_amount_brl: features.min_withdrawal_amount_brl,
      days: features.withdrawal_days,
    };
  }

  /** Verifica se uma feature booleana está disponível no plano do músico. */
  async assertMusicianFeature(
    musician_id: string,
    feature: keyof Pick<
      MusicianPlanFeatures,
      | "realtime_analytics"
      | "custom_qr_code"
      | "music_library_access"
      | "auto_split_management"
      | "api_access"
      | "white_label"
    >,
  ): Promise<void> {
    const features = await this.getMusicianFeatures(musician_id);
    if (!features[feature]) {
      throw new PlanLimitExceededError(
        `Esta funcionalidade não está disponível no seu plano atual. Faça upgrade para acessá-la.`,
      );
    }
  }

  /** Verifica se uma feature booleana está disponível no plano do estabelecimento. */
  async assertEstablishmentFeature(
    establishment_id: string,
    feature: keyof Pick<
      EstablishmentPlanFeatures,
      | "advanced_analytics"
      | "promotional_campaigns"
      | "api_access"
      | "multi_establishment"
    >,
  ): Promise<void> {
    const features = await this.getEstablishmentFeatures(establishment_id);
    if (!features[feature]) {
      throw new PlanLimitExceededError(
        `Esta funcionalidade não está disponível no plano atual do estabelecimento. Faça upgrade para acessá-la.`,
      );
    }
  }

  /** Verifica se o músico pode gerar mais banners este mês. */
  async assertMusicianCanGenerateBanner(
    musician_id: string,
    current_month_count: number,
  ): Promise<void> {
    const features = await this.getMusicianFeatures(musician_id);
    if (features.banner_generation_per_month === 0) {
      throw new PlanLimitExceededError(
        `Geração de banners não está disponível no plano gratuito. Faça upgrade para acessá-la.`,
      );
    }
    if (
      features.banner_generation_per_month !== null &&
      current_month_count >= features.banner_generation_per_month
    ) {
      throw new PlanLimitExceededError(
        `Limite de ${features.banner_generation_per_month} banners/mês atingido. Faça upgrade para gerar mais.`,
      );
    }
  }

  /** Verifica se o estabelecimento pode gerar mais banners este mês. */
  async assertEstablishmentCanGenerateBanner(
    establishment_id: string,
    current_month_count: number,
  ): Promise<void> {
    const features = await this.getEstablishmentFeatures(establishment_id);
    if (features.banner_generation_per_month === 0) {
      throw new PlanLimitExceededError(
        `Geração de banners não está disponível no plano gratuito. Faça upgrade para acessá-la.`,
      );
    }
    if (
      features.banner_generation_per_month !== null &&
      current_month_count >= features.banner_generation_per_month
    ) {
      throw new PlanLimitExceededError(
        `Limite de ${features.banner_generation_per_month} banners/mês atingido. Faça upgrade para gerar mais.`,
      );
    }
  }
}
