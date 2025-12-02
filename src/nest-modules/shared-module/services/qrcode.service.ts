import { Injectable, Logger } from "@nestjs/common";
import * as QRCode from "qrcode";
import { ConfigSchemaType } from "../../config-module/config.schema";

export interface QRCodeOptions {
  width?: number;
  height?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

export interface MusicianQRData {
  musicianId: string;
  stageName: string;
  profileUrl: string;
  timestamp: number;
}

@Injectable()
export class QRCodeService {
  private readonly logger = new Logger(QRCodeService.name);
  private readonly baseUrl: string;

  constructor(private configService: ConfigSchemaType) {
    this.baseUrl = this.configService.get("APP_URL") || "https://soundmeet.app";
  }

  /**
   * Generate QR Code as Data URL (base64)
   */
  async generateDataURL(
    data: string,
    options?: QRCodeOptions,
  ): Promise<string> {
    try {
      const qrOptions = {
        width: options?.width || 300,
        margin: options?.margin || 2,
        color: {
          dark: options?.color?.dark || "#000000",
          light: options?.color?.light || "#FFFFFF",
        },
        errorCorrectionLevel: options?.errorCorrectionLevel || "M",
      };

      const dataURL = await QRCode.toDataURL(data, qrOptions);
      this.logger.debug(
        `QR Code generated for data: ${data.substring(0, 50)}...`,
      );

      return dataURL;
    } catch (error) {
      this.logger.error("Error generating QR Code:", error);
      throw new Error("Failed to generate QR Code");
    }
  }

  /**
   * Generate QR Code as SVG string
   */
  async generateSVG(data: string, options?: QRCodeOptions): Promise<string> {
    try {
      const qrOptions = {
        width: options?.width || 300,
        margin: options?.margin || 2,
        color: {
          dark: options?.color?.dark || "#000000",
          light: options?.color?.light || "#FFFFFF",
        },
        errorCorrectionLevel: options?.errorCorrectionLevel || "M",
      };

      const svg = await QRCode.toString(data, { type: "svg", ...qrOptions });
      this.logger.debug(
        `QR Code SVG generated for data: ${data.substring(0, 50)}...`,
      );

      return svg;
    } catch (error) {
      this.logger.error("Error generating QR Code SVG:", error);
      throw new Error("Failed to generate QR Code SVG");
    }
  }

  /**
   * Generate QR Code for musician profile
   */
  async generateMusicianQR(
    musicianId: string,
    stageName: string,
    options?: QRCodeOptions,
  ): Promise<string> {
    const profileUrl = `${this.baseUrl}/musician/${musicianId}`;

    const qrData: MusicianQRData = {
      musicianId,
      stageName,
      profileUrl,
      timestamp: Date.now(),
    };

    // For QR codes, we'll use the profile URL directly for better compatibility
    // The mobile app can parse the URL to extract musician info
    return this.generateDataURL(profileUrl, options);
  }

  /**
   * Generate QR Code for musician profile as SVG
   */
  async generateMusicianQRSVG(
    musicianId: string,
    stageName: string,
    options?: QRCodeOptions,
  ): Promise<string> {
    const profileUrl = `${this.baseUrl}/musician/${musicianId}`;

    return this.generateSVG(profileUrl, options);
  }

  /**
   * Generate QR Code for payment/tip
   */
  async generatePaymentQR(
    musicianId: string,
    amount?: number,
    message?: string,
  ): Promise<string> {
    const paymentUrl = `${this.baseUrl}/tip/${musicianId}`;
    const params = new URLSearchParams();

    if (amount) {
      params.append("amount", amount.toString());
    }

    if (message) {
      params.append("message", encodeURIComponent(message));
    }

    const fullUrl = params.toString()
      ? `${paymentUrl}?${params.toString()}`
      : paymentUrl;

    return this.generateDataURL(fullUrl);
  }

  /**
   * Generate QR Code for event/establishment
   */
  async generateEventQR(
    establishmentId: string,
    eventId?: string,
  ): Promise<string> {
    const baseEventUrl = `${this.baseUrl}/event/${establishmentId}`;
    const eventUrl = eventId ? `${baseEventUrl}/${eventId}` : baseEventUrl;

    return this.generateDataURL(eventUrl);
  }

  /**
   * Validate QR Code data
   */
  isValidMusicianQR(data: string): boolean {
    try {
      const url = new URL(data);
      return (
        url.hostname.includes("soundmeet") &&
        url.pathname.includes("/musician/")
      );
    } catch {
      return false;
    }
  }

  /**
   * Extract musician ID from QR code data
   */
  extractMusicianId(data: string): string | null {
    try {
      const url = new URL(data);
      const pathParts = url.pathname.split("/");
      const musicianIndex = pathParts.indexOf("musician");

      if (musicianIndex !== -1 && pathParts[musicianIndex + 1]) {
        return pathParts[musicianIndex + 1];
      }

      return null;
    } catch {
      return null;
    }
  }
}
