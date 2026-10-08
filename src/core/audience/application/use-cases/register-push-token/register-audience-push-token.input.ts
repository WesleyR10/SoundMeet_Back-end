import { IsIn, IsString, IsUUID, Matches } from "class-validator";

/** Espelho de `RegisterPushTokenInput` do músico — mesmo formato de token. */
export class RegisterAudiencePushTokenInput {
  @IsUUID()
  id: string;

  @IsString()
  @Matches(/^ExponentPushToken\[.+\]$/, {
    message: "push_token must be a valid Expo push token",
  })
  push_token: string;

  @IsIn(["ios", "android"])
  push_token_platform: "ios" | "android";
}
