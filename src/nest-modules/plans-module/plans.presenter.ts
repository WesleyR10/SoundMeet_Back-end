import { ApiProperty } from "@nestjs/swagger";

import { SubscriptionOutput } from "../../core/plans/application/use-cases/common/subscription-output";
import { CreateSubscriptionCheckoutOutput } from "../../core/plans/application/use-cases/create-subscription-checkout/create-subscription-checkout.use-case";
import { GetActiveSubscriptionOutput } from "../../core/plans/application/use-cases/get-active-subscription/get-active-subscription.use-case";
import {
  ListPlansOutput,
  PublicMusicianPlanFeatures,
} from "../../core/plans/application/use-cases/list-plans/list-plans.use-case";
import {
  EstablishmentPlanFeatures,
  PlanPricing,
} from "../../core/plans/domain/plan-features.config";

export class PlansCatalogPresenter {
  @ApiProperty({ description: "Tiers do músico com preços e features" })
  musician: Array<{
    tier: string;
    pricing: PlanPricing;
    // Sem os campos de antifraude (max_withdrawal_*): catálogo é @Public().
    features: PublicMusicianPlanFeatures;
  }>;

  @ApiProperty({
    description: "Tiers do estabelecimento com preços e features",
  })
  establishment: Array<{
    tier: string;
    pricing: PlanPricing;
    features: EstablishmentPlanFeatures;
  }>;

  @ApiProperty({
    description:
      'Features anunciadas como roadmap. A UI DEVE marcá-las como "em breve" ' +
      "em vez de exibi-las como incluídas no tier (decisão 9.7a).",
  })
  coming_soon: { musician: string[]; establishment: string[] };

  constructor(output: ListPlansOutput) {
    this.musician = output.musician;
    this.establishment = output.establishment;
    this.coming_soon = output.coming_soon;
  }
}

export class SubscriptionPresenter {
  @ApiProperty()
  subscription_id: string;

  @ApiProperty({ nullable: true })
  musician_id: string | null;

  @ApiProperty({ nullable: true })
  establishment_id: string | null;

  @ApiProperty()
  plan_tier: string;

  @ApiProperty()
  persona: string;

  @ApiProperty()
  billing_cycle: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  started_at: Date;

  @ApiProperty({ nullable: true })
  expires_at: Date | null;

  @ApiProperty({ nullable: true })
  trial_ends_at: Date | null;

  @ApiProperty({ nullable: true })
  cancelled_at: Date | null;

  @ApiProperty()
  created_at: Date;

  constructor(output: SubscriptionOutput) {
    this.subscription_id = output.subscription_id;
    this.musician_id = output.musician_id;
    this.establishment_id = output.establishment_id;
    this.plan_tier = output.plan_tier;
    this.persona = output.persona;
    this.billing_cycle = output.billing_cycle;
    this.status = output.status;
    this.started_at = output.started_at;
    this.expires_at = output.expires_at;
    this.trial_ends_at = output.trial_ends_at;
    this.cancelled_at = output.cancelled_at;
    this.created_at = output.created_at;
  }
}

export class ActiveSubscriptionPresenter {
  @ApiProperty({
    description: 'Tier em vigor — "free" quando não há assinatura ativa',
  })
  effective_tier: string;

  @ApiProperty({ type: SubscriptionPresenter, nullable: true })
  subscription: SubscriptionPresenter | null;

  constructor(output: GetActiveSubscriptionOutput) {
    this.effective_tier = output.effective_tier;
    this.subscription = output.subscription
      ? new SubscriptionPresenter(output.subscription)
      : null;
  }
}

export class SubscriptionCheckoutPresenter {
  @ApiProperty({ description: "Id da assinatura no gateway (Asaas)" })
  gateway_subscription_id: string;

  @ApiProperty({
    nullable: true,
    description: "URL da fatura hospedada onde o usuário conclui o pagamento",
  })
  checkout_url: string | null;

  @ApiProperty()
  plan_tier: string;

  @ApiProperty()
  billing_cycle: string;

  @ApiProperty({ description: "Valor da cobrança em BRL" })
  amount_brl: number;

  constructor(output: CreateSubscriptionCheckoutOutput) {
    this.gateway_subscription_id = output.gateway_subscription_id;
    this.checkout_url = output.checkout_url;
    this.plan_tier = output.plan_tier;
    this.billing_cycle = output.billing_cycle;
    this.amount_brl = output.amount_brl;
  }
}
