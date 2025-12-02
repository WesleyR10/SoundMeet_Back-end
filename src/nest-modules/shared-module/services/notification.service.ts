import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as admin from "firebase-admin";
import { ConfigSchemaType } from "../../config-module/config.schema";

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
  sound?: string;
  badge?: number;
}

export interface NotificationTarget {
  userId?: string;
  deviceToken?: string;
  topic?: string;
  userType?: "musician" | "establishment" | "audience";
}

export interface NotificationOptions {
  priority?: "high" | "normal";
  timeToLive?: number; // TTL in seconds
  collapseKey?: string;
  restrictedPackageName?: string;
  dryRun?: boolean;
}

export interface BulkNotificationResult {
  successCount: number;
  failureCount: number;
  responses: admin.messaging.SendResponse[];
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private firebaseApp: admin.app.App;

  constructor(private configService: ConfigSchemaType) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      const serviceAccountKey = this.configService.get(
        "FIREBASE_SERVICE_ACCOUNT_KEY",
      );
      const projectId = this.configService.get("FIREBASE_PROJECT_ID");

      if (!serviceAccountKey || !projectId) {
        this.logger.warn(
          "Firebase credentials not configured. Push notifications will be disabled.",
        );
        return;
      }

      const serviceAccount = JSON.parse(serviceAccountKey);

      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });

      this.logger.log("Firebase Admin SDK initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize Firebase Admin SDK:", error);
    }
  }

  /**
   * Send push notification (generic wrapper)
   */
  async sendPushNotification(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string> {
    const payload: PushNotificationPayload = {
      title,
      body,
      data,
    };
    return this.sendToDevice(deviceToken, payload);
  }

  /**
   * Send push notification to a single device
   */
  async sendToDevice(
    deviceToken: string,
    payload: PushNotificationPayload,
    options: NotificationOptions = {},
  ): Promise<string> {
    if (!this.firebaseApp) {
      throw new Error("Firebase not initialized");
    }

    try {
      const message: admin.messaging.Message = {
        token: deviceToken,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data || {},
        android: {
          priority: options.priority || "high",
          ttl: options.timeToLive ? options.timeToLive * 1000 : undefined,
          collapseKey: options.collapseKey,
          restrictedPackageName: options.restrictedPackageName,
          notification: {
            sound: payload.sound || "default",
            clickAction: payload.clickAction,
            channelId: "soundmeet_notifications",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: payload.sound || "default",
              badge: payload.badge,
              category: payload.clickAction,
            },
          },
        },
      };

      const response = await admin.messaging().send(message, options.dryRun);
      this.logger.debug(`Push notification sent successfully: ${response}`);
      return response;
    } catch (error) {
      this.logger.error("Failed to send push notification:", error);
      throw new Error(`Push notification failed: ${error.message}`);
    }
  }

  /**
   * Send push notification to multiple devices
   */
  async sendToDevices(
    deviceTokens: string[],
    payload: PushNotificationPayload,
    options: NotificationOptions = {},
  ): Promise<BulkNotificationResult> {
    if (!this.firebaseApp) {
      throw new Error("Firebase not initialized");
    }

    if (deviceTokens.length === 0) {
      return { successCount: 0, failureCount: 0, responses: [] };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: deviceTokens,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data || {},
        android: {
          priority: options.priority || "high",
          ttl: options.timeToLive ? options.timeToLive * 1000 : undefined,
          collapseKey: options.collapseKey,
          notification: {
            sound: payload.sound || "default",
            clickAction: payload.clickAction,
            channelId: "soundmeet_notifications",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: payload.sound || "default",
              badge: payload.badge,
              category: payload.clickAction,
            },
          },
        },
      };

      const response = await admin
        .messaging()
        .sendEachForMulticast(message, options.dryRun);

      this.logger.debug(
        `Bulk push notification sent. Success: ${response.successCount}, Failure: ${response.failureCount}`,
      );

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses,
      };
    } catch (error) {
      this.logger.error("Failed to send bulk push notifications:", error);
      throw new Error(`Bulk push notification failed: ${error.message}`);
    }
  }

  /**
   * Send push notification to a topic
   */
  async sendToTopic(
    topic: string,
    payload: PushNotificationPayload,
    options: NotificationOptions = {},
  ): Promise<string> {
    if (!this.firebaseApp) {
      throw new Error("Firebase not initialized");
    }

    try {
      const message: admin.messaging.Message = {
        topic,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data || {},
        android: {
          priority: options.priority || "high",
          ttl: options.timeToLive ? options.timeToLive * 1000 : undefined,
          notification: {
            sound: payload.sound || "default",
            clickAction: payload.clickAction,
            channelId: "soundmeet_notifications",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: payload.sound || "default",
              badge: payload.badge,
              category: payload.clickAction,
            },
          },
        },
      };

      const response = await admin.messaging().send(message, options.dryRun);
      this.logger.debug(`Topic notification sent successfully: ${response}`);
      return response;
    } catch (error) {
      this.logger.error("Failed to send topic notification:", error);
      throw new Error(`Topic notification failed: ${error.message}`);
    }
  }

  /**
   * Send notification to a topic (alias for sendToTopic)
   */
  async sendTopicNotification(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string> {
    const payload: PushNotificationPayload = {
      title,
      body,
      data,
    };
    return this.sendToTopic(topic, payload);
  }

  /**
   * Subscribe device to topic
   */
  async subscribeToTopic(deviceTokens: string[], topic: string): Promise<void> {
    if (!this.firebaseApp) {
      throw new Error("Firebase not initialized");
    }

    try {
      await admin.messaging().subscribeToTopic(deviceTokens, topic);
      this.logger.debug(
        `${deviceTokens.length} devices subscribed to topic: ${topic}`,
      );
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic ${topic}:`, error);
      throw new Error(`Topic subscription failed: ${error.message}`);
    }
  }

  /**
   * Unsubscribe device from topic
   */
  async unsubscribeFromTopic(
    deviceTokens: string[],
    topic: string,
  ): Promise<void> {
    if (!this.firebaseApp) {
      throw new Error("Firebase not initialized");
    }

    try {
      await admin.messaging().unsubscribeFromTopic(deviceTokens, topic);
      this.logger.debug(
        `${deviceTokens.length} devices unsubscribed from topic: ${topic}`,
      );
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from topic ${topic}:`, error);
      throw new Error(`Topic unsubscription failed: ${error.message}`);
    }
  }

  /**
   * Send notification for new music request
   */
  async sendMusicRequestNotification(
    musicianDeviceToken: string,
    requesterName: string,
    songTitle: string,
    establishmentName: string,
  ): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "Novo Pedido Musical! 🎵",
      body: `${requesterName} pediu "${songTitle}" no ${establishmentName}`,
      data: {
        type: "music_request",
        requesterName,
        songTitle,
        establishmentName,
      },
      clickAction: "MUSIC_REQUEST_ACTION",
      sound: "notification_sound",
    };

    await this.sendToDevice(musicianDeviceToken, payload, { priority: "high" });
  }

  /**
   * Send notification for tip received
   */
  async sendTipNotification(
    musicianDeviceToken: string,
    tipAmount: number,
    tipperName: string,
    message?: string,
  ): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "Gorjeta Recebida! 💰",
      body: `${tipperName} enviou R$ ${tipAmount.toFixed(2)}${message ? ` - "${message}"` : ""}`,
      data: {
        type: "tip_received",
        amount: tipAmount.toString(),
        tipperName,
        message: message || "",
      },
      clickAction: "TIP_ACTION",
      sound: "tip_sound",
    };

    await this.sendToDevice(musicianDeviceToken, payload, { priority: "high" });
  }

  /**
   * Send notification for request status update
   */
  async sendRequestStatusNotification(
    requesterDeviceToken: string,
    status: "accepted" | "rejected",
    songTitle: string,
    musicianName: string,
  ): Promise<void> {
    const isAccepted = status === "accepted";
    const payload: PushNotificationPayload = {
      title: isAccepted ? "Pedido Aceito! ✅" : "Pedido Recusado ❌",
      body: `${musicianName} ${isAccepted ? "aceitou" : "recusou"} seu pedido: "${songTitle}"`,
      data: {
        type: "request_status",
        status,
        songTitle,
        musicianName,
      },
      clickAction: "REQUEST_STATUS_ACTION",
      sound: "default",
    };

    await this.sendToDevice(requesterDeviceToken, payload);
  }

  /**
   * Send notification for gamification achievement
   */
  async sendAchievementNotification(
    userDeviceToken: string,
    badgeName: string,
    points: number,
  ): Promise<void> {
    const payload: PushNotificationPayload = {
      title: "Nova Conquista! 🏆",
      body: `Você desbloqueou: ${badgeName} (+${points} pontos)`,
      data: {
        type: "achievement",
        badgeName,
        points: points.toString(),
      },
      clickAction: "ACHIEVEMENT_ACTION",
      sound: "achievement_sound",
    };

    await this.sendToDevice(userDeviceToken, payload);
  }
}
