import { IUseCase } from "../../../../shared/application/use-case.interface";
import { ConflictError } from "../../../../shared/domain/errors/conflict.error";
import { ExternalServiceError } from "../../../../shared/domain/errors/external-service.error";
import { InvalidArgumentError } from "../../../../shared/domain/errors/invalid-argument.error";
import {
  ESTABLISHMENT_PLAN_PRICING,
  MUSICIAN_PLAN_PRICING,
  PlanPricing,
} from "../../../domain/plan-features.config";
import {
  BillingCycle,
  EstablishmentPlanTier,
  MusicianPlanTier,
  SubscriptionPersona,
} from "../../../domain/plan-tier.enum";
import { ISubscriptionRepository } from "../../../domain/subscription.repository";
import {
  ISubscriptionBillingGateway,
  SubscriptionBillingError,
} from "../../ports/subscription-billing.gateway";
import { buildSubscriptionReference } from "../common/subscription-external-reference";

export type CreateSubscriptionCheckoutInput = {
  persona: SubscriptionPersona;
  entity_id: string;
  plan_tier: string;
  billing_cycle: BillingCycle;
  payer: {
    name: string;
    email: string;
    cpf_cnpj: string;
  };
};

export type CreateSubscriptionCheckoutOutput = {
  gateway_subscription_id: string;
  checkout_url: string | null;
  plan_tier: string;
  billing_cycle: BillingCycle;
  amount_brl: number;
};

/**
 * Inicia o checkout de assinatura recorrente no gateway (Asaas).
 *
 * A assinatura LOCAL não é criada aqui — o usuário permanece FREE até o
 * primeiro pagamento ser confirmado via webhook (PAYMENT_RECEIVED/CONFIRMED
 * com payment.subscription), quando ActivateSubscriptionFromPaymentUseCase
 * materializa/renova o registro. Fonte de verdade do upgrade = dinheiro
 * recebido, nunca a intenção de compra.
 */
export class CreateSubscriptionCheckoutUseCase implements IUseCase<
  CreateSubscriptionCheckoutInput,
  CreateSubscriptionCheckoutOutput
> {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly billingGateway: ISubscriptionBillingGateway,
  ) {}

  async execute(
    input: CreateSubscriptionCheckoutInput,
  ): Promise<CreateSubscriptionCheckoutOutput> {
    const pricing = this.resolvePaidTierPricing(input.persona, input.plan_tier);

    const amount_brl =
      input.billing_cycle === BillingCycle.ANNUAL
        ? pricing.annual_price_brl
        : pricing.monthly_price_brl;

    const existing =
      input.persona === "musician"
        ? await this.subscriptionRepo.findActiveMusicianSubscription(
            input.entity_id,
          )
        : await this.subscriptionRepo.findActiveEstablishmentSubscription(
            input.entity_id,
          );

    if (
      existing?.isActive() &&
      existing.plan_tier === input.plan_tier &&
      existing.billing_cycle === input.billing_cycle
    ) {
      throw new ConflictError(
        "Você já possui uma assinatura ativa neste plano.",
      );
    }

    const external_reference = buildSubscriptionReference({
      persona: input.persona,
      entity_id: input.entity_id,
      plan_tier: input.plan_tier,
      billing_cycle: input.billing_cycle,
    });

    try {
      const { gateway_customer_id } = await this.billingGateway.createCustomer({
        name: input.payer.name,
        email: input.payer.email,
        cpf_cnpj: input.payer.cpf_cnpj,
        external_reference: input.entity_id,
      });

      const checkout = await this.billingGateway.createSubscription({
        gateway_customer_id,
        value_brl: amount_brl,
        cycle: input.billing_cycle,
        description: `SoundMeet ${input.persona === "musician" ? "Músico" : "Estabelecimento"} — plano ${input.plan_tier} (${input.billing_cycle})`,
        external_reference,
      });

      return {
        gateway_subscription_id: checkout.gateway_subscription_id,
        checkout_url: checkout.checkout_url,
        plan_tier: input.plan_tier,
        billing_cycle: input.billing_cycle,
        amount_brl,
      };
    } catch (error) {
      if (error instanceof SubscriptionBillingError) {
        throw new ExternalServiceError(
          "Falha ao iniciar o checkout no provedor de pagamento. Tente novamente.",
          { cause: error },
        );
      }
      throw error;
    }
  }

  private resolvePaidTierPricing(
    persona: SubscriptionPersona,
    plan_tier: string,
  ): PlanPricing {
    const pricingTable: Record<string, PlanPricing> =
      persona === "musician"
        ? MUSICIAN_PLAN_PRICING
        : ESTABLISHMENT_PLAN_PRICING;
    const freeTier: string =
      persona === "musician"
        ? MusicianPlanTier.FREE
        : EstablishmentPlanTier.FREE;

    const pricing = pricingTable[plan_tier];
    if (!pricing) {
      throw new InvalidArgumentError(
        `Plano desconhecido para ${persona}: ${plan_tier}`,
      );
    }
    if (plan_tier === freeTier) {
      throw new InvalidArgumentError(
        "O plano FREE não requer checkout — é o tier padrão sem assinatura.",
      );
    }
    return pricing;
  }
}
