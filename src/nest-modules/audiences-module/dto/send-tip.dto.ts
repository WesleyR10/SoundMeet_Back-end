import { OmitType } from "@nestjs/swagger";

import { SendTipInputValidator } from "../../../core/audience/application/use-cases/send-tip/send-tip.input";

export class SendTipInputWithoutId extends OmitType(SendTipInputValidator, [
  "id",
] as const) {}

export class SendTipDto extends SendTipInputWithoutId {}
