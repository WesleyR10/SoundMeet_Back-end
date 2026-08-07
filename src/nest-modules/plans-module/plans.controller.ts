import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { CancelSubscriptionUseCase } from "../../core/plans/application/use-cases/cancel-subscription/cancel-subscription.use-case";
import { CreateSubscriptionCheckoutUseCase } from "../../core/plans/application/use-cases/create-subscription-checkout/create-subscription-checkout.use-case";
import { GetActiveSubscriptionUseCase } from "../../core/plans/application/use-cases/get-active-subscription/get-active-subscription.use-case";
import { ListPlansUseCase } from "../../core/plans/application/use-cases/list-plans/list-plans.use-case";
import { SubscriptionPersona } from "../../core/plans/domain/plan-tier.enum";
import {
  AuthGuard,
  CurrentUserContextGuard,
  EstablishmentOwnershipGuard,
  MusicianOwnershipGuard,
  Public,
  Roles,
  RolesGuard,
} from "../auth-module";
import { CreateSubscriptionCheckoutDto } from "./dto/create-subscription-checkout.dto";
import {
  ActiveSubscriptionPresenter,
  PlansCatalogPresenter,
  SubscriptionCheckoutPresenter,
  SubscriptionPresenter,
} from "./plans.presenter";

@ApiTags("Plans")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller()
export class PlansController {
  @Inject(ListPlansUseCase)
  private listPlansUseCase: ListPlansUseCase;

  @Inject(GetActiveSubscriptionUseCase)
  private getActiveSubscriptionUseCase: GetActiveSubscriptionUseCase;

  @Inject(CreateSubscriptionCheckoutUseCase)
  private createCheckoutUseCase: CreateSubscriptionCheckoutUseCase;

  @Inject(CancelSubscriptionUseCase)
  private cancelSubscriptionUseCase: CancelSubscriptionUseCase;

  @Get("plans")
  @Public()
  @ApiOperation({
    summary: "Catálogo público de planos",
    description:
      "Preços e features de todos os tiers (músico e estabelecimento). Fonte única: plan-features.config.ts — o app não deve espelhar esses valores localmente.",
  })
  @ApiResponse({ status: 200, type: PlansCatalogPresenter })
  async listPlans() {
    const output = await this.listPlansUseCase.execute();
    return new PlansCatalogPresenter(output);
  }

  // ── Músico ────────────────────────────────────────────────────────────────

  @Get("musicians/:musician_id/subscription")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({ summary: "Assinatura ativa do músico (ou free)" })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: ActiveSubscriptionPresenter })
  async getMusicianSubscription(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
  ) {
    const output = await this.getActiveSubscriptionUseCase.execute({
      persona: "musician",
      entity_id: musician_id,
    });
    return new ActiveSubscriptionPresenter(output);
  }

  @Post("musicians/:musician_id/subscription/checkout")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: "Iniciar checkout de assinatura do músico (Asaas)",
    description:
      "Cria a assinatura recorrente no gateway e retorna a URL de pagamento. O plano local só é ativado quando o webhook confirmar o primeiro pagamento.",
  })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: SubscriptionCheckoutPresenter })
  @ApiResponse({ status: 409, description: "Assinatura já ativa neste plano" })
  async createMusicianCheckout(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @Body() dto: CreateSubscriptionCheckoutDto,
  ) {
    return this.checkout("musician", musician_id, dto);
  }

  @Delete("musicians/:musician_id/subscription")
  @Roles("musician", "admin")
  @UseGuards(MusicianOwnershipGuard)
  @ApiOperation({ summary: "Cancelar assinatura ativa do músico" })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: SubscriptionPresenter })
  @ApiResponse({ status: 404, description: "Sem assinatura ativa" })
  async cancelMusicianSubscription(
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
  ) {
    const output = await this.cancelSubscriptionUseCase.execute({
      persona: "musician",
      entity_id: musician_id,
    });
    return new SubscriptionPresenter(output);
  }

  // ── Estabelecimento ───────────────────────────────────────────────────────

  @Get("establishments/:establishment_id/subscription")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({ summary: "Assinatura ativa do estabelecimento (ou free)" })
  @ApiParam({ name: "establishment_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: ActiveSubscriptionPresenter })
  async getEstablishmentSubscription(
    @Param("establishment_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    establishment_id: string,
  ) {
    const output = await this.getActiveSubscriptionUseCase.execute({
      persona: "establishment",
      entity_id: establishment_id,
    });
    return new ActiveSubscriptionPresenter(output);
  }

  @Post("establishments/:establishment_id/subscription/checkout")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: "Iniciar checkout de assinatura do estabelecimento (Asaas)",
  })
  @ApiParam({ name: "establishment_id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: SubscriptionCheckoutPresenter })
  @ApiResponse({ status: 409, description: "Assinatura já ativa neste plano" })
  async createEstablishmentCheckout(
    @Param("establishment_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    establishment_id: string,
    @Body() dto: CreateSubscriptionCheckoutDto,
  ) {
    return this.checkout("establishment", establishment_id, dto);
  }

  @Delete("establishments/:establishment_id/subscription")
  @Roles("establishment", "admin")
  @UseGuards(EstablishmentOwnershipGuard)
  @ApiOperation({ summary: "Cancelar assinatura ativa do estabelecimento" })
  @ApiParam({ name: "establishment_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: SubscriptionPresenter })
  @ApiResponse({ status: 404, description: "Sem assinatura ativa" })
  async cancelEstablishmentSubscription(
    @Param("establishment_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    establishment_id: string,
  ) {
    const output = await this.cancelSubscriptionUseCase.execute({
      persona: "establishment",
      entity_id: establishment_id,
    });
    return new SubscriptionPresenter(output);
  }

  private async checkout(
    persona: SubscriptionPersona,
    entity_id: string,
    dto: CreateSubscriptionCheckoutDto,
  ) {
    const output = await this.createCheckoutUseCase.execute({
      persona,
      entity_id,
      plan_tier: dto.plan_tier,
      billing_cycle: dto.billing_cycle,
      payer: {
        name: dto.payer_name,
        email: dto.payer_email,
        cpf_cnpj: dto.payer_cpf_cnpj,
      },
    });
    return new SubscriptionCheckoutPresenter(output);
  }
}
