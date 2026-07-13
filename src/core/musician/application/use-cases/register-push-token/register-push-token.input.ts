import { IsIn, IsString, IsUUID, Matches } from "class-validator";

export class RegisterPushTokenInput {
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
