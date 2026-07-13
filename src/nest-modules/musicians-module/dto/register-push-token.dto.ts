import { OmitType } from "@nestjs/swagger";

import { RegisterPushTokenInput } from "../../../core/musician/application/use-cases/register-push-token/register-push-token.input";

export class RegisterPushTokenInputWithoutId extends OmitType(
  RegisterPushTokenInput,
  ["id"] as const,
) {}

export class RegisterPushTokenDto extends RegisterPushTokenInputWithoutId {}
