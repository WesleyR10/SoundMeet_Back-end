import { IsIn, IsNotEmpty, IsString } from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";
import { Subscription } from "./subscription.aggregate";

const VALID_PERSONAS = ["musician", "establishment"];
const VALID_BILLING_CYCLES = ["monthly", "annual"] as const;

export class SubscriptionRules {
  @IsNotEmpty({ groups: ["plan_tier"] })
  @IsString({ groups: ["plan_tier"] })
  plan_tier: string;

  @IsIn(VALID_PERSONAS, { groups: ["persona"] })
  @IsNotEmpty({ groups: ["persona"] })
  persona: string;

  @IsIn(VALID_BILLING_CYCLES, { groups: ["billing_cycle"] })
  @IsNotEmpty({ groups: ["billing_cycle"] })
  billing_cycle: string;

  constructor(entity: Subscription) {
    this.plan_tier = entity.plan_tier;
    this.persona = entity.persona;
    this.billing_cycle = entity.billing_cycle;
  }
}

export class SubscriptionValidator extends ClassValidatorFields {
  validate(
    notification: Notification,
    entity: Subscription,
    fields?: string[],
  ): boolean {
    return super.validate(
      notification,
      new SubscriptionRules(entity),
      fields ?? ["plan_tier", "persona", "billing_cycle"],
    );
  }
}

export class SubscriptionValidatorFactory {
  static create(): SubscriptionValidator {
    return new SubscriptionValidator();
  }
}
