import { ValueObject } from "../value-object";

export type PointsSource =
  | "scan_qr"
  | "music_request"
  | "accepted_request"
  | "tip"
  | "social_share"
  | "discovery"
  | "attendance"
  | "bonus";

export type PointsProps = {
  value: number;
  source: PointsSource;
  description?: string;
  metadata?: Record<string, any>;
  earnedAt: Date;
};

export class Points extends ValueObject {
  readonly value: number;
  readonly source: PointsSource;
  readonly description?: string;
  readonly metadata?: Record<string, any>;
  readonly earnedAt: Date;

  constructor(props: PointsProps) {
    super();
    this.value = props.value;
    this.source = props.source;
    this.description = props.description;
    this.metadata = props.metadata;
    this.earnedAt = props.earnedAt;
    this.validate();
  }

  private validate(): void {
    if (this.value < 0) {
      throw new InvalidPointsError(
        "Points value must be greater than or equal to 0",
      );
    }

    if (!this.earnedAt) {
      throw new InvalidPointsError("Earned at date is required");
    }

    if (this.earnedAt > new Date()) {
      throw new InvalidPointsError("Earned at date cannot be in the future");
    }
  }

  static createScanQR(metadata?: Record<string, any>): Points {
    return new Points({
      value: 10,
      source: "scan_qr",
      description: "QR code escaneado",
      metadata,
      earnedAt: new Date(),
    });
  }

  static createMusicRequest(metadata?: Record<string, any>): Points {
    return new Points({
      value: 25,
      source: "music_request",
      description: "Pedido musical realizado",
      metadata,
      earnedAt: new Date(),
    });
  }

  static createAcceptedRequest(metadata?: Record<string, any>): Points {
    return new Points({
      value: 50,
      source: "accepted_request",
      description: "Pedido musical aceito pelo músico",
      metadata,
      earnedAt: new Date(),
    });
  }

  static createTip(amount: number, metadata?: Record<string, any>): Points {
    return new Points({
      value: Math.floor(amount), // 1 ponto por real
      source: "tip",
      description: `Gorjeta de R$ ${amount.toFixed(2)} enviada`,
      metadata: { ...metadata, tipAmount: amount },
      earnedAt: new Date(),
    });
  }

  static createSocialShare(
    platform: string,
    metadata?: Record<string, any>,
  ): Points {
    return new Points({
      value: 50,
      source: "social_share",
      description: `Compartilhamento no ${platform}`,
      metadata: { ...metadata, platform },
      earnedAt: new Date(),
    });
  }

  static createDiscovery(metadata?: Record<string, any>): Points {
    return new Points({
      value: 10,
      source: "discovery",
      description: "Novo músico descoberto",
      metadata,
      earnedAt: new Date(),
    });
  }

  static createAttendance(metadata?: Record<string, any>): Points {
    return new Points({
      value: 20,
      source: "attendance",
      description: "Participação em evento",
      metadata,
      earnedAt: new Date(),
    });
  }

  static createBonus(
    value: number,
    description: string,
    metadata?: Record<string, any>,
  ): Points {
    return new Points({
      value,
      source: "bonus",
      description,
      metadata,
      earnedAt: new Date(),
    });
  }

  static create(
    value: number,
    source: PointsSource,
    description?: string,
    metadata?: Record<string, any>,
  ): Points {
    return new Points({
      value,
      source,
      description,
      metadata,
      earnedAt: new Date(),
    });
  }

  isRecent(hours: number = 24): boolean {
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - hours);
    return this.earnedAt >= hoursAgo;
  }

  getSourceDisplayName(): string {
    const sourceNames: Record<PointsSource, string> = {
      scan_qr: "Scan QR",
      music_request: "Pedido Musical",
      accepted_request: "Pedido Aceito",
      tip: "Gorjeta",
      social_share: "Compartilhamento",
      discovery: "Descoberta",
      attendance: "Participação",
      bonus: "Bônus",
    };

    return sourceNames[this.source] || this.source;
  }

  toJSON() {
    return {
      value: this.value,
      source: this.source,
      sourceDisplayName: this.getSourceDisplayName(),
      description: this.description,
      metadata: this.metadata,
      earnedAt: this.earnedAt,
      isRecent: this.isRecent(),
    };
  }
}

export class InvalidPointsError extends Error {
  constructor(message?: string) {
    super(message || "Invalid points");
    this.name = "InvalidPointsError";
  }
}
