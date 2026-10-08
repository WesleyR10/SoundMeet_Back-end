import { EstablishmentPlanTier, MusicianPlanTier } from "./plan-tier.enum";

export interface PlanPricing {
  monthly_price_brl: number;
  annual_price_brl: number;
  /** Economia ao escolher anual vs 12×mensal */
  annual_savings_brl: number;
  /** Percentual de desconto anual arredondado */
  annual_discount_percent: number;
}

// =============================================================
// CONFIGURAÇÃO CENTRAL DE PLANOS — ALTERE AQUI PARA MODIFICAR
// Preços de lançamento (jun/2026): revisão prevista ao atingir
// 1.000 assinantes pagantes. Clientes existentes grandfathered.
// =============================================================

export interface MusicianPlanFeatures {
  /** percentual total retido sobre gorjetas (inclui ~1% de gateway) */
  tip_fee_percentage: number;
  /**
   * Percentual retido sobre o CACHÊ de show custodiado (F1.3a).
   *
   * Distinto de `tip_fee_percentage`: gorjeta e cachê são vértices diferentes,
   * com gateways diferentes (Mercado Pago vs Asaas) e tickets de ordem de
   * grandeza diferente (R$5–60 vs R$200–5.000).
   *
   * Hoje é 10% em todos os tiers — o 90/10 acordado em
   * `decisoes-de-gateway.md`. Fica aqui, e não como constante do domínio
   * de pagamento, porque **toda taxa do sistema muda num arquivo só**: baixar a
   * comissão do PRO para 8% é editar um número desta tabela, sem tocar em
   * use-case nenhum.
   *
   * 🔴 **Mudar aqui não alcança show já contratado.** A comissão é congelada em
   * `BookingEscrow.create` e a cláusula do contrato remete ao percentual
   * "vigente na data de emissão deste instrumento" — é a âncora que impede um
   * reajuste posterior de virar cláusula potestativa. Mas exige que a UI informe
   * o número ao músico antes do aceite, porque é isso que a cláusula pressupõe.
   */
  booking_fee_percentage: number;
  /** valor mínimo em BRL para saque */
  min_withdrawal_amount_brl: number;
  /** dias úteis para saque ser creditado (1 = até 24h) */
  withdrawal_days: number;
  /**
   * Teto de VALOR de saque nas últimas 24h, em R$ (A1 — antifraude). Limita a
   * drenagem de um token comprometido. Escolhido por tier: FREE mais baixo
   * (conta nova, menos histórico), pagos alinhados ao limite do provedor de
   * saída (Asaas PF: R$5.000/dia). `null` = sem teto próprio (só o do provedor).
   */
  max_withdrawal_per_day_brl: number | null;
  /**
   * Teto de CONTAGEM de saques nas últimas 24h (velocity). Contorna a drenagem
   * por muitos saques pequenos que o teto de valor deixaria passar. `null` = sem
   * limite de contagem.
   */
  max_withdrawals_per_day: number | null;
  /**
   * Dias após a apresentação até a custódia do cachê ser liberada (F1.3a).
   *
   * D+2 para plano pago e D+5 para FREE, como acordado em
   * `decisoes-de-gateway.md`. É o **holdback**, e não o prazo de saque:
   * quem já pagou por um plano recebe antes, e é um dos argumentos de venda
   * mais concretos do tier — mas o prazo mínimo existe para todo mundo, porque
   * é a janela em que o estabelecimento pode contestar.
   */
  escrow_release_days: number;
  /** máximo de repertórios; null = ilimitado */
  max_repertoires: number | null;
  /** máximo de músicas por repertório; null = ilimitado */
  max_songs_per_repertoire: number | null;
  /** banners geráveis por mês; 0 = indisponível; null = ilimitado */
  banner_generation_per_month: number;
  realtime_analytics: boolean;
  custom_qr_code: boolean;
  music_library_access: boolean;
  /** null = feature de banda não disponível; número = máx. de membros */
  max_band_members: number | null;
  auto_split_management: boolean;
  api_access: boolean;
  white_label: boolean;
  /** link de compartilhamento de repertório (read-only temporário); false = FREE */
  repertoire_sharing: boolean;
  /** convite nominal de músico para acessar repertório; true = PRO only */
  repertoire_nominal_invite: boolean;
  /** máximo de cifras pessoais (forks); null = ilimitado */
  max_personal_chord_sheets: number | null;
  /** publicar a própria cifra na comunidade; false = FREE */
  chord_sheet_community_sharing: boolean;
  /** filtro de ruído do afinador cromático; true = ESSENCIAL + PRO */
  tuner_noise_filter: boolean;
}

export interface EstablishmentPlanFeatures {
  /** banners geráveis por mês; 0 = indisponível; null = ilimitado */
  banner_generation_per_month: number;
  advanced_analytics: boolean;
  promotional_campaigns: boolean;
  api_access: boolean;
  multi_establishment: boolean;
}

// =============================================================
// Features anunciadas como ROADMAP, não como entrega — 9.7a
// (decisão de produto, 16/ago/2026)
//
// Existem no catálogo para a UI poder dizer "em breve" com todas
// as letras. NÃO são gates: não há capacidade nenhuma por trás
// delas no código, então bloquear ou liberar por plano é mentira
// nos dois sentidos. Por isso ficam FORA das uniões aceitas por
// `assertMusicianFeature`/`assertEstablishmentFeature` — tentar
// gatear uma delas é erro de compilação, não bug em produção.
//
// Ao implementar a capacidade de verdade: remova a chave daqui
// (o `satisfies` garante que o nome existe) e o `Exclude` do
// plan-check.service passa a aceitá-la como gate normal.
// =============================================================

export const COMING_SOON_MUSICIAN_FEATURES = [
  "api_access",
  "white_label",
] as const satisfies readonly (keyof MusicianPlanFeatures)[];

export const COMING_SOON_ESTABLISHMENT_FEATURES = [
  "api_access",
] as const satisfies readonly (keyof EstablishmentPlanFeatures)[];

export type ComingSoonMusicianFeature =
  (typeof COMING_SOON_MUSICIAN_FEATURES)[number];

export type ComingSoonEstablishmentFeature =
  (typeof COMING_SOON_ESTABLISHMENT_FEATURES)[number];

// ------------------------------------------------------------
// Músicos — 3 tiers
// Free → Essencial (R$34,90/mês | R$300/ano)
//       → Pro      (R$74,90/mês | R$670/ano)
// ------------------------------------------------------------
export const MUSICIAN_PLAN_FEATURES: Record<
  MusicianPlanTier,
  MusicianPlanFeatures
> = {
  [MusicianPlanTier.FREE]: {
    tip_fee_percentage: 9,
    booking_fee_percentage: 10,
    min_withdrawal_amount_brl: 110,
    withdrawal_days: 5,
    max_withdrawal_per_day_brl: 2000,
    max_withdrawals_per_day: 5,
    escrow_release_days: 5,
    max_repertoires: 1,
    max_songs_per_repertoire: 20,
    banner_generation_per_month: 0,
    realtime_analytics: false,
    custom_qr_code: false,
    music_library_access: true,
    max_band_members: null,
    auto_split_management: false,
    api_access: false,
    white_label: false,
    repertoire_sharing: false,
    repertoire_nominal_invite: false,
    // Editar e transpor cifra é CORE em todos os tiers (decisão 4C.5, coerente
    // com music_library_access: true nos três). O que o FREE não tem é volume
    // e publicação — nunca a ferramenta.
    max_personal_chord_sheets: 3,
    chord_sheet_community_sharing: false,
    tuner_noise_filter: false,
  },
  [MusicianPlanTier.ESSENTIAL]: {
    tip_fee_percentage: 7,
    booking_fee_percentage: 10,
    min_withdrawal_amount_brl: 70,
    withdrawal_days: 3,
    max_withdrawal_per_day_brl: 5000,
    max_withdrawals_per_day: 5,
    escrow_release_days: 2,
    max_repertoires: 3,
    max_songs_per_repertoire: 80,
    banner_generation_per_month: 3,
    realtime_analytics: true,
    custom_qr_code: false,
    music_library_access: true,
    max_band_members: null,
    auto_split_management: false,
    api_access: false,
    white_label: false,
    repertoire_sharing: true,
    repertoire_nominal_invite: false,
    max_personal_chord_sheets: null,
    chord_sheet_community_sharing: true,
    tuner_noise_filter: true,
  },
  [MusicianPlanTier.PRO]: {
    tip_fee_percentage: 5,
    booking_fee_percentage: 10,
    min_withdrawal_amount_brl: 50,
    withdrawal_days: 1,
    max_withdrawal_per_day_brl: 5000,
    max_withdrawals_per_day: 5,
    escrow_release_days: 2,
    max_repertoires: null,
    max_songs_per_repertoire: null,
    banner_generation_per_month: 15,
    realtime_analytics: true,
    custom_qr_code: true,
    music_library_access: true,
    max_band_members: 8,
    auto_split_management: true,
    api_access: false,
    white_label: false,
    repertoire_sharing: true,
    repertoire_nominal_invite: true,
    max_personal_chord_sheets: null,
    chord_sheet_community_sharing: true,
    tuner_noise_filter: true,
  },
};

// ------------------------------------------------------------
// Estabelecimentos — 3 tiers
// Free → Growth (R$34,90/mês | R$300/ano)
//       → Pro   (R$74,90/mês | R$670/ano)
// Busca e chat com músicos são ilimitados em todos os planos.
// ------------------------------------------------------------
export const ESTABLISHMENT_PLAN_FEATURES: Record<
  EstablishmentPlanTier,
  EstablishmentPlanFeatures
> = {
  [EstablishmentPlanTier.FREE]: {
    banner_generation_per_month: 0,
    advanced_analytics: false,
    promotional_campaigns: false,
    api_access: false,
    multi_establishment: false,
  },
  [EstablishmentPlanTier.GROWTH]: {
    banner_generation_per_month: 3,
    advanced_analytics: true,
    promotional_campaigns: true,
    api_access: false,
    multi_establishment: false,
  },
  [EstablishmentPlanTier.PRO]: {
    banner_generation_per_month: 15,
    advanced_analytics: true,
    promotional_campaigns: true,
    api_access: true,
    multi_establishment: true,
  },
};

// ------------------------------------------------------------
// Preços — lançamento jun/2026
// Revisão prevista ao atingir 1.000 assinantes pagantes.
// Clientes existentes grandfathered nos valores atuais.
// ------------------------------------------------------------
export const MUSICIAN_PLAN_PRICING: Record<MusicianPlanTier, PlanPricing> = {
  [MusicianPlanTier.FREE]: {
    monthly_price_brl: 0,
    annual_price_brl: 0,
    annual_savings_brl: 0,
    annual_discount_percent: 0,
  },
  [MusicianPlanTier.ESSENTIAL]: {
    monthly_price_brl: 34.9,
    annual_price_brl: 300,
    annual_savings_brl: 118.8,
    annual_discount_percent: 28,
  },
  [MusicianPlanTier.PRO]: {
    monthly_price_brl: 74.9,
    annual_price_brl: 670,
    annual_savings_brl: 228.8,
    annual_discount_percent: 25,
  },
};

export const ESTABLISHMENT_PLAN_PRICING: Record<
  EstablishmentPlanTier,
  PlanPricing
> = {
  [EstablishmentPlanTier.FREE]: {
    monthly_price_brl: 0,
    annual_price_brl: 0,
    annual_savings_brl: 0,
    annual_discount_percent: 0,
  },
  [EstablishmentPlanTier.GROWTH]: {
    monthly_price_brl: 34.9,
    annual_price_brl: 300,
    annual_savings_brl: 118.8,
    annual_discount_percent: 28,
  },
  [EstablishmentPlanTier.PRO]: {
    monthly_price_brl: 74.9,
    annual_price_brl: 670,
    annual_savings_brl: 228.8,
    annual_discount_percent: 25,
  },
};
