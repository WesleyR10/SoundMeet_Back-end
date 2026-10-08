import { OmitType } from "@nestjs/swagger";

import { RegisterAudiencePushTokenInput } from "../../../core/audience/application/use-cases/register-push-token/register-audience-push-token.input";

export class RegisterAudiencePushTokenDto extends OmitType(
  RegisterAudiencePushTokenInput,
  ["id"] as const,
) {}
