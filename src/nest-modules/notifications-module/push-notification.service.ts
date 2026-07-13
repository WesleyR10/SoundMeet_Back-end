import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Expo } from "expo-server-sdk";

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

// Wrapper fino sobre expo-server-sdk. Expo intermedia o credential exchange
// com FCM/APNs via EAS — não falamos direto com Firebase/Apple aqui.
// Checagem de receipts (detectar DeviceNotRegistered e limpar o token
// morto) fica fora de escopo por ora: um token de device desinstalado só
// fica parado, inofensivo, até o próximo registerPushToken.
@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly expo: Expo;

  constructor(configService: ConfigService) {
    const accessToken = configService.get<string>("EXPO_ACCESS_TOKEN");
    this.expo = new Expo(accessToken ? { accessToken } : undefined);
  }

  async send(pushToken: string, message: PushMessage): Promise<void> {
    if (!Expo.isExpoPushToken(pushToken)) {
      this.logger.warn(`Invalid Expo push token, skipping: ${pushToken}`);
      return;
    }

    const tickets = await this.expo.sendPushNotificationsAsync([
      {
        to: pushToken,
        sound: "default",
        title: message.title,
        body: message.body,
        data: message.data,
      },
    ]);

    const errorTicket = tickets.find((ticket) => ticket.status === "error");
    if (errorTicket) {
      this.logger.warn(
        `Push ticket returned error: ${JSON.stringify(errorTicket)}`,
      );
    }
  }
}
