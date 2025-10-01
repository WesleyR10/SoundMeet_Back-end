import { ValueObject } from "../value-object";

export type BadgeType =
  | "iniciante"
  | "sugestor"
  | "acertador"
  | "apoiador"
  | "mecenas"
  | "socializer"
  | "discoverer"
  | "super_fa";

export type BadgeCategory = "engagement" | "support" | "discovery" | "social";

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

export type BadgeProps = {
  type: BadgeType;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  pointsRequired: number;
  earnedAt?: Date;
  progress?: number;
};

export class Badge extends ValueObject {
  readonly type: BadgeType;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly category: BadgeCategory;
  readonly rarity: BadgeRarity;
  readonly pointsRequired: number;
  readonly earnedAt?: Date;
  readonly progress?: number;

  constructor(props: BadgeProps) {
    super();
    this.type = props.type;
    this.name = props.name;
    this.description = props.description;
    this.icon = props.icon;
    this.category = props.category;
    this.rarity = props.rarity;
    this.pointsRequired = props.pointsRequired;
    this.earnedAt = props.earnedAt;
    this.progress = props.progress;
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new InvalidBadgeError("Badge name is required");
    }

    if (!this.description || this.description.trim().length === 0) {
      throw new InvalidBadgeError("Badge description is required");
    }

    if (this.pointsRequired < 0) {
      throw new InvalidBadgeError(
        "Points required must be greater than or equal to 0",
      );
    }

    if (
      this.progress !== undefined &&
      (this.progress < 0 || this.progress > 100)
    ) {
      throw new InvalidBadgeError("Progress must be between 0 and 100");
    }
  }

  static createIniciante(): Badge {
    return new Badge({
      type: "iniciante",
      name: "Iniciante",
      description: "Primeiro scan de QR code realizado",
      icon: "🎵",
      category: "engagement",
      rarity: "common",
      pointsRequired: 10,
    });
  }

  static createSugestor(): Badge {
    return new Badge({
      type: "sugestor",
      name: "Sugestor Criativo",
      description: "10 pedidos musicais realizados",
      icon: "🎤",
      category: "engagement",
      rarity: "common",
      pointsRequired: 250,
    });
  }

  static createAcertador(): Badge {
    return new Badge({
      type: "acertador",
      name: "Acertador",
      description: "5 pedidos aceitos pelos músicos",
      icon: "🎯",
      category: "engagement",
      rarity: "rare",
      pointsRequired: 250,
    });
  }

  static createApoiador(): Badge {
    return new Badge({
      type: "apoiador",
      name: "Apoiador",
      description: "Primeira gorjeta enviada",
      icon: "💰",
      category: "support",
      rarity: "common",
      pointsRequired: 1,
    });
  }

  static createMecenas(): Badge {
    return new Badge({
      type: "mecenas",
      name: "Mecenas",
      description: "R$ 100 em gorjetas enviadas",
      icon: "👑",
      category: "support",
      rarity: "legendary",
      pointsRequired: 100,
    });
  }

  static createSocializer(): Badge {
    return new Badge({
      type: "socializer",
      name: "Socializer",
      description: "5 compartilhamentos nas redes sociais",
      icon: "📱",
      category: "social",
      rarity: "rare",
      pointsRequired: 250,
    });
  }

  static createDiscoverer(): Badge {
    return new Badge({
      type: "discoverer",
      name: "Discoverer",
      description: "10 músicos diferentes descobertos",
      icon: "🔍",
      category: "discovery",
      rarity: "epic",
      pointsRequired: 100,
    });
  }

  static createSuperFa(): Badge {
    return new Badge({
      type: "super_fa",
      name: "Super Fã",
      description: "Todas as outras badges conquistadas",
      icon: "⭐",
      category: "engagement",
      rarity: "legendary",
      pointsRequired: 1000,
    });
  }

  isEarned(): boolean {
    return this.earnedAt !== undefined;
  }

  getProgressPercentage(): number {
    return this.progress || 0;
  }

  toJSON() {
    return {
      type: this.type,
      name: this.name,
      description: this.description,
      icon: this.icon,
      category: this.category,
      rarity: this.rarity,
      pointsRequired: this.pointsRequired,
      earnedAt: this.earnedAt,
      progress: this.progress,
      isEarned: this.isEarned(),
      progressPercentage: this.getProgressPercentage(),
    };
  }
}

export class InvalidBadgeError extends Error {
  constructor(message?: string) {
    super(message || "Invalid badge");
    this.name = "InvalidBadgeError";
  }
}
