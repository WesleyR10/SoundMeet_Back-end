import { IsIn, IsString, IsUUID, Matches } from "class-validator";

export class RegisterPushTokenInput {
  @IsUUID()
  id: string;

  /*
   * Os DOIS prefixos. A Expo emite `ExponentPushToken[...]` e
   * `ExpoPushToken[...]`, e o `expo-server-sdk` que envia o push aceita ambos
   * (`Expo.isExpoPushToken`). Aceitar só o primeiro recusaria com 422 um token
   * que o próprio serviço de envio considera válido — e o app engole esse erro
   * de propósito, então o músico ficaria sem push sem ninguém ver por quê.
   */
  @IsString()
  @Matches(/^Expo(nent)?PushToken\[.+\]$/, {
    message: "push_token must be a valid Expo push token",
  })
  push_token: string;

  @IsIn(["ios", "android"])
  push_token_platform: "ios" | "android";
}
