import { EstablishmentPlanTier, MusicianPlanTier } from "./plan-tier.enum";

// =============================================================
// CONFIGURAÇÃO CENTRAL DE PLANOS — ALTERE AQUI PARA MODIFICAR
// Preços de lançamento (jun/2026): revisão prevista ao atingir
// 1.000 assinantes pagantes. Clientes existentes grandfathered.
// =============================================================

export interface MusicianPlanFeatures {
  /** percentual total retido sobre gorjetas (inclui ~1% de gateway) */
  tip_fee_percentage: number;
  /** valor mínimo em BRL para saque */
  min_withdrawal_amount_brl: number;
  /** dias úteis para saque ser creditado (1 = até 24h) */
  withdrawal_days: number;
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
}

export interface EstablishmentPlanFeatures {
  /** máximo de QR codes simultâneos; null = ilimitado */
  max_qr_codes: number | null;
  /** banners geráveis por mês; 0 = indisponível; null = ilimitado */
  banner_generation_per_month: number;
  advanced_analytics: boolean;
  promotional_campaigns: boolean;
  api_access: boolean;
  multi_establishment: boolean;
}

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
    min_withdrawal_amount_brl: 110,
    withdrawal_days: 5,
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
  },
  [MusicianPlanTier.ESSENTIAL]: {
    tip_fee_percentage: 7,
    min_withdrawal_amount_brl: 70,
    withdrawal_days: 3,
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
  },
  [MusicianPlanTier.PRO]: {
    tip_fee_percentage: 5,
    min_withdrawal_amount_brl: 50,
    withdrawal_days: 1,
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
    max_qr_codes: 1,
    banner_generation_per_month: 0,
    advanced_analytics: false,
    promotional_campaigns: false,
    api_access: false,
    multi_establishment: false,
  },
  [EstablishmentPlanTier.GROWTH]: {
    max_qr_codes: 3,
    banner_generation_per_month: 3,
    advanced_analytics: true,
    promotional_campaigns: true,
    api_access: false,
    multi_establishment: false,
  },
  [EstablishmentPlanTier.PRO]: {
    max_qr_codes: null,
    banner_generation_per_month: 15,
    advanced_analytics: true,
    promotional_campaigns: true,
    api_access: true,
    multi_establishment: true,
  },
};
