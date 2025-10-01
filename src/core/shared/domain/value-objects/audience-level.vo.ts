import { ValueObject } from "../value-object";

export type AudienceLevelProps = {
  level: number;
  name: string;
  minPoints: number;
  maxPoints: number;
  benefits: string[];
};

export class AudienceLevel extends ValueObject {
  readonly level: number;
  readonly name: string;
  readonly minPoints: number;
  readonly maxPoints: number;
  readonly benefits: string[];

  constructor(props: AudienceLevelProps) {
    super();
    this.level = props.level;
    this.name = props.name;
    this.minPoints = props.minPoints;
    this.maxPoints = props.maxPoints;
    this.benefits = props.benefits;
    this.validate();
  }

  static create(level: number): AudienceLevel {
    const levelData = this.getLevelData(level);
    return new AudienceLevel(levelData);
  }

  static fromPoints(points: number): AudienceLevel {
    const level = this.calculateLevelFromPoints(points);
    return this.create(level);
  }

  private static getLevelData(level: number): AudienceLevelProps {
    const levels: Record<number, AudienceLevelProps> = {
      1: {
        level: 1,
        name: "Iniciante Musical",
        minPoints: 0,
        maxPoints: 99,
        benefits: ["Acesso básico à plataforma", "Pedidos musicais limitados"],
      },
      2: {
        level: 2,
        name: "Fã Engajado",
        minPoints: 100,
        maxPoints: 299,
        benefits: ["Mais pedidos por evento", "Acesso a estatísticas básicas"],
      },
      3: {
        level: 3,
        name: "Sugestor Ativo",
        minPoints: 300,
        maxPoints: 599,
        benefits: [
          "Pedidos prioritários",
          "Badge personalizado",
          "Histórico completo",
        ],
      },
      4: {
        level: 4,
        name: "Apoiador Premium",
        minPoints: 600,
        maxPoints: 999,
        benefits: [
          "Acesso antecipado",
          "Descontos em eventos",
          "Conteúdo exclusivo",
        ],
      },
      5: {
        level: 5,
        name: "Super Fã",
        minPoints: 1000,
        maxPoints: 1999,
        benefits: [
          "Todos os benefícios anteriores",
          "Meet & greet exclusivo",
          "Influência no repertório",
        ],
      },
      6: {
        level: 6,
        name: "Mecenas Musical",
        minPoints: 2000,
        maxPoints: Number.MAX_SAFE_INTEGER,
        benefits: [
          "Status VIP",
          "Acesso backstage",
          "Participação em decisões artísticas",
        ],
      },
    };

    return levels[level] || levels[1];
  }

  private static calculateLevelFromPoints(points: number): number {
    if (points >= 2000) return 6;
    if (points >= 1000) return 5;
    if (points >= 600) return 4;
    if (points >= 300) return 3;
    if (points >= 100) return 2;
    return 1;
  }

  canMakeRequest(): boolean {
    return this.level >= 1;
  }

  getMaxRequestsPerEvent(): number {
    const limits: Record<number, number> = {
      1: 2,
      2: 3,
      3: 5,
      4: 7,
      5: 10,
      6: 15,
    };
    return limits[this.level] || 2;
  }

  hasVipAccess(): boolean {
    return this.level >= 4;
  }

  canAccessExclusiveContent(): boolean {
    return this.level >= 4;
  }

  getNextLevel(): AudienceLevel | null {
    if (this.level >= 6) return null;
    return AudienceLevel.create(this.level + 1);
  }

  getPointsToNextLevel(): number {
    const nextLevel = this.getNextLevel();
    if (!nextLevel) return 0;
    return nextLevel.minPoints - this.maxPoints;
  }

  private validate(): void {
    if (this.level < 1 || this.level > 6) {
      throw new Error("Level must be between 1 and 6");
    }
    if (this.minPoints < 0) {
      throw new Error("Min points cannot be negative");
    }
    if (this.maxPoints < this.minPoints) {
      throw new Error("Max points must be greater than min points");
    }
    if (!this.name || this.name.trim().length === 0) {
      throw new Error("Level name is required");
    }
    if (!Array.isArray(this.benefits) || this.benefits.length === 0) {
      throw new Error("Level benefits are required");
    }
  }

  equals(other: AudienceLevel): boolean {
    return this.level === other.level;
  }

  toJSON() {
    return {
      level: this.level,
      name: this.name,
      minPoints: this.minPoints,
      maxPoints: this.maxPoints,
      benefits: this.benefits,
    };
  }
}
