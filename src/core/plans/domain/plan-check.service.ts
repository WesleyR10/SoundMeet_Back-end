import { PlanLimitExceededError } from "./errors/plan-limit-exceeded.error";
import {
  ComingSoonEstablishmentFeature,
  ComingSoonMusicianFeature,
  ESTABLISHMENT_PLAN_FEATURES,
  ESTABLISHMENT_PLAN_PRICING,
  EstablishmentPlanFeatures,
  MUSICIAN_PLAN_FEATURES,
  MUSICIAN_PLAN_PRICING,
  MusicianPlanFeatures,
  PlanPricing,
} from "./plan-features.config";
import {
  BillingCycle,
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

  /**
   * Ids dos músicos com assinatura paga vigente.
   *
   * Existe para a faixa "Em destaque" da grade de artistas, e passa por aqui
   * em vez de `PlansModule` exportar o repositório de assinaturas: o
   * `PlanCheckService` já é a única costura pela qual o módulo de músico
   * pergunta sobre plano, e abrir uma segunda daria dois caminhos para a mesma
   * informação — o começo de duas regras divergentes sobre o que conta como
   * "pagante".
   */
  async getActivePaidMusicianIds(): Promise<string[]> {
    return this.subscriptionRepository.findActivePaidMusicianIds();
  }

  async getMusicianFeatures(
    musician_id: string,
  ): Promise<MusicianPlanFeatures> {
    const tier = await this.getMusicianPlanTier(musician_id);
    return (
      MUSICIAN_PLAN_FEATURES[tier] ??
      MUSICIAN_PLAN_FEATURES[MusicianPlanTier.FREE]
    );
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
    return (
      ESTABLISHMENT_PLAN_FEATURES[tier] ??
      ESTABLISHMENT_PLAN_FEATURES[EstablishmentPlanTier.FREE]
    );
  }

  /** Retorna o percentual de taxa da plataforma sobre gorjetas (ex.: 9 = 9%). */
  async getMusicianTipFeePercentage(musician_id: string): Promise<number> {
    const features = await this.getMusicianFeatures(musician_id);
    return features.tip_fee_percentage;
  }

  /**
   * Percentual retido sobre o CACHÊ custodiado (ex.: 10 = 10%).
   *
   * Separado de `getMusicianTipFeePercentage` porque são dois vértices
   * distintos: a gorjeta liquida no Mercado Pago, o cachê no Asaas, e nada
   * garante que os dois percentuais andem juntos numa revisão de preços.
   */
  async getMusicianBookingFeePercentage(musician_id: string): Promise<number> {
    const features = await this.getMusicianFeatures(musician_id);
    return features.booking_fee_percentage;
  }

  /** Retorna configuração de saque do músico com base no plano ativo. */
  async getMusicianWithdrawalConfig(musician_id: string): Promise<{
    min_amount_brl: number;
    days: number;
    max_per_day_brl: number | null;
    max_count_per_day: number | null;
  }> {
    const features = await this.getMusicianFeatures(musician_id);
    return {
      min_amount_brl: features.min_withdrawal_amount_brl,
      days: features.withdrawal_days,
      max_per_day_brl: features.max_withdrawal_per_day_brl,
      max_count_per_day: features.max_withdrawals_per_day,
    };
  }

  /**
   * Holdback da custódia do cachê: D+2 no plano pago, D+5 no FREE.
   *
   * ⚠️ **Não é gate, é prazo.** Ninguém é bloqueado — o FREE recebe, só recebe
   * depois. É a diferença entre vender uma vantagem e reter dinheiro alheio, e
   * a segunda coisa não é uma opção quando o valor está em custódia.
   */
  async getMusicianEscrowReleaseDays(musician_id: string): Promise<number> {
    const features = await this.getMusicianFeatures(musician_id);
    return features.escrow_release_days;
  }

  /**
   * Verifica se uma feature booleana está disponível no plano do músico.
   *
   * ⚠️ Enforcement é só NO MOMENTO DA AÇÃO (ex.: ShareRepertoireUseCase,
   * InviteMusicianUseCase chamam isto uma vez, ao compartilhar/convidar) —
   * nunca revalidado depois, em leituras subsequentes. Se o músico fizer
   * downgrade de PRO pra FREE depois de compartilhar um repertório ou
   * convidar alguém, o acesso já concedido (link público ativo, convidado
   * na lista) continua valendo indefinidamente até alguém desativar/revogar
   * manualmente — não existe um job ou checagem em GET que re-audita
   * gates antigos. Isto é intencional e consistente em todo o projeto (todo
   * gate de plano segue esse padrão, não é peculiaridade do Repertoire),
   * mas é fácil esquecer ao debugar "por que esse usuário FREE ainda tem
   * acesso a X". Ver Docs/_privado/produto/planos-do-musico.md, seção "Enforcement de
   * gates: ação vs. leitura".
   */
  async assertMusicianFeature(
    musician_id: string,
    feature: Exclude<
      keyof Pick<
        MusicianPlanFeatures,
        | "realtime_analytics"
        | "custom_qr_code"
        | "music_library_access"
        | "auto_split_management"
        | "api_access"
        | "white_label"
        | "repertoire_sharing"
        | "repertoire_nominal_invite"
        | "chord_sheet_community_sharing"
        | "tuner_noise_filter"
      >,
      ComingSoonMusicianFeature
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
    feature: Exclude<
      keyof Pick<
        EstablishmentPlanFeatures,
        | "advanced_analytics"
        | "promotional_campaigns"
        | "api_access"
        | "multi_establishment"
      >,
      ComingSoonEstablishmentFeature
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

  /** Retorna o ciclo de cobrança da assinatura ativa do músico. */
  async getMusicianBillingCycle(musician_id: string): Promise<BillingCycle> {
    const sub =
      await this.subscriptionRepository.findActiveMusicianSubscription(
        musician_id,
      );
    if (!sub || !sub.isActive()) return BillingCycle.MONTHLY;
    return sub.billing_cycle;
  }

  /** Retorna o ciclo de cobrança da assinatura ativa do estabelecimento. */
  async getEstablishmentBillingCycle(
    establishment_id: string,
  ): Promise<BillingCycle> {
    const sub =
      await this.subscriptionRepository.findActiveEstablishmentSubscription(
        establishment_id,
      );
    if (!sub || !sub.isActive()) return BillingCycle.MONTHLY;
    return sub.billing_cycle;
  }

  /** Retorna o pricing de exibição/checkout para o tier atual do músico. */
  async getMusicianPlanPricing(musician_id: string): Promise<PlanPricing> {
    const tier = await this.getMusicianPlanTier(musician_id);
    return (
      MUSICIAN_PLAN_PRICING[tier] ??
      MUSICIAN_PLAN_PRICING[MusicianPlanTier.FREE]
    );
  }

  /** Retorna o pricing de exibição/checkout para o tier atual do estabelecimento. */
  async getEstablishmentPlanPricing(
    establishment_id: string,
  ): Promise<PlanPricing> {
    const tier = await this.getEstablishmentPlanTier(establishment_id);
    return (
      ESTABLISHMENT_PLAN_PRICING[tier] ??
      ESTABLISHMENT_PLAN_PRICING[EstablishmentPlanTier.FREE]
    );
  }

  /** Verifica se o músico pode criar mais repertórios com base no plano. */
  async assertMusicianCanCreateRepertoire(
    musician_id: string,
    current_count: number,
  ): Promise<void> {
    const features = await this.getMusicianFeatures(musician_id);
    if (
      features.max_repertoires !== null &&
      current_count >= features.max_repertoires
    ) {
      throw new PlanLimitExceededError(
        `Limite de ${features.max_repertoires} repertório(s) atingido. Faça upgrade para criar mais.`,
      );
    }
  }

  /**
   * Verifica se o LÍDER pode convidar mais um integrante para a banda.
   *
   * São duas perguntas do mesmo plano, respondidas juntas para o líder
   * receber o motivo certo:
   *
   * 1. **Banda com integrantes é do PRO** (`auto_split_management`): o que o
   *    plano vende é a divisão automática da gorjeta entre os integrantes.
   * 2. **Teto de integrantes** (`max_band_members`). 🔴 Até out/2026 o número
   *    era exibido no app ("até 8") e não era conferido em lugar nenhum — um
   *    líder PRO convidava cinquenta. `current_member_count` conta o líder,
   *    os aceitos E os convites pendentes: convite em aberto ocupa vaga, senão
   *    dez convites simultâneos passariam todos pelo teto.
   *
   * Grant-at-action, como os demais gates: cobrado no convite, nunca na
   * leitura. Quem cair do PRO continua com a banda que já montou.
   */
  async assertBandCanAddMember(
    leader_musician_id: string,
    current_member_count: number,
  ): Promise<void> {
    const features = await this.getMusicianFeatures(leader_musician_id);

    if (!features.auto_split_management || features.max_band_members === null) {
      throw new PlanLimitExceededError(
        "Convidar integrantes para a banda é um recurso do plano PRO. Faça upgrade para montar a sua.",
      );
    }

    if (current_member_count >= features.max_band_members) {
      throw new PlanLimitExceededError(
        `Limite de ${features.max_band_members} integrantes por banda atingido, contando os convites em aberto.`,
      );
    }
  }

  /**
   * Verifica se o músico pode criar mais uma cifra pessoal (fork).
   *
   * Grant-at-action: cobrado no fork e no import, NUNCA na leitura. Um músico
   * que caia do PRO para o FREE continua abrindo e tocando as cifras que já
   * tem — ele só não cria a próxima. Bloquear leitura seria tirar do palco uma
   * cifra que ele já corrigiu.
   */
  async assertMusicianCanCreatePersonalChordSheet(
    musician_id: string,
    current_count: number,
  ): Promise<void> {
    const features = await this.getMusicianFeatures(musician_id);
    if (
      features.max_personal_chord_sheets !== null &&
      current_count >= features.max_personal_chord_sheets
    ) {
      throw new PlanLimitExceededError(
        `Limite de ${features.max_personal_chord_sheets} cifra(s) pessoal(is) atingido. Faça upgrade para criar mais.`,
      );
    }
  }

  /** Verifica se o músico pode adicionar mais músicas ao repertório com base no plano. */
  async assertMusicianCanAddSongToRepertoire(
    musician_id: string,
    current_songs_count: number,
  ): Promise<void> {
    const features = await this.getMusicianFeatures(musician_id);
    if (
      features.max_songs_per_repertoire !== null &&
      current_songs_count >= features.max_songs_per_repertoire
    ) {
      throw new PlanLimitExceededError(
        `Limite de ${features.max_songs_per_repertoire} músicas por repertório atingido. Faça upgrade para adicionar mais.`,
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
