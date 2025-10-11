import { ValueObject } from "../../../shared/domain/value-object";

export type UserLevelProps = {
  level: number;
  name: string;
  minPoints: number;
  maxPoints: number;
  benefits: string[];
};

export class UserLevel extends ValueObject {
  readonly level: number;
  readonly name: string;
  readonly minPoints: number;
  readonly maxPoints: number;
  readonly benefits: string[];

  constructor(props: UserLevelProps) {
    super();
    this.level = props.level;
    this.name = props.name;
    this.minPoints = props.minPoints;
    this.maxPoints = props.maxPoints;
    this.benefits = props.benefits;
    this.validate();
  }

  private validate(): void {
    if (this.level < 1) {
      throw new InvalidUserLevelError("Level must be greater than 0");
    }

    if (this.minPoints < 0) {
      throw new InvalidUserLevelError(
        "Min points must be greater than or equal to 0",
      );
    }

    if (this.maxPoints <= this.minPoints) {
      throw new InvalidUserLevelError(
        "Max points must be greater than min points",
      );
    }

    if (!this.name || this.name.trim().length === 0) {
      throw new InvalidUserLevelError("Name is required");
    }
  }

  static create(props: UserLevelProps): UserLevel {
    return new UserLevel(props);
  }

  static createLevel1(): UserLevel {
    return new UserLevel({
      level: 1,
      name: "Novato",
      minPoints: 0,
      maxPoints: 99,
      benefits: ["Acesso básico ao app"],
    });
  }

  static createLevel2(): UserLevel {
    return new UserLevel({
      level: 2,
      name: "Fã",
      minPoints: 100,
      maxPoints: 299,
      benefits: [
        "Acesso básico ao app",
        "Badge de Fã",
        "Desconto de 5% em gorjetas",
      ],
    });
  }

  static createLevel3(): UserLevel {
    return new UserLevel({
      level: 3,
      name: "Apoiador",
      minPoints: 300,
      maxPoints: 599,
      benefits: [
        "Acesso básico ao app",
        "Badge de Apoiador",
        "Prioridade em pedidos",
        "Desconto de 10% em gorjetas",
      ],
    });
  }

  static createLevel4(): UserLevel {
    return new UserLevel({
      level: 4,
      name: "VIP",
      minPoints: 600,
      maxPoints: 999,
      benefits: [
        "Acesso básico ao app",
        "Badge VIP",
        "Prioridade em pedidos",
        "Desconto em consumação",
        "Acesso prioritário a eventos",
      ],
    });
  }

  static createLevel5(): UserLevel {
    return new UserLevel({
      level: 5,
      name: "Lenda",
      minPoints: 1000,
      maxPoints: Number.MAX_SAFE_INTEGER,
      benefits: [
        "Acesso básico ao app",
        "Badge Lenda",
        "Prioridade máxima em pedidos",
        "Desconto VIP em consumação",
        "Acesso a eventos exclusivos",
        "Todos os benefícios anteriores",
      ],
    });
  }

  static getLevelByPoints(points: number): UserLevel {
    if (points < 0) {
      throw new InvalidUserLevelError("Points cannot be negative");
    }
    if (points < 100) return UserLevel.createLevel1();
    if (points < 300) return UserLevel.createLevel2();
    if (points < 600) return UserLevel.createLevel3();
    if (points < 1000) return UserLevel.createLevel4();
    return UserLevel.createLevel5();
  }

  // Métodos estáticos de conveniência para os testes
  static level1(): UserLevel {
    return UserLevel.createLevel1();
  }

  static level2(): UserLevel {
    return UserLevel.createLevel2();
  }

  static level3(): UserLevel {
    return UserLevel.createLevel3();
  }

  static level4(): UserLevel {
    return UserLevel.createLevel4();
  }

  static level5(): UserLevel {
    return UserLevel.createLevel5();
  }

  static getAllLevels(): UserLevel[] {
    return [
      UserLevel.createLevel1(),
      UserLevel.createLevel2(),
      UserLevel.createLevel3(),
      UserLevel.createLevel4(),
      UserLevel.createLevel5(),
    ];
  }

  isMaxLevel(): boolean {
    return this.level === 5;
  }

  getNextLevel(): UserLevel | null {
    if (this.isMaxLevel()) return null;

    const allLevels = UserLevel.getAllLevels();
    return allLevels.find((level) => level.level === this.level + 1) || null;
  }

  getProgressToNextLevel(currentPoints: number): number {
    if (this.isMaxLevel()) return 100;

    const pointsInCurrentLevel = currentPoints - this.minPoints;
    const pointsNeededForLevel = this.maxPoints - this.minPoints + 1; // +1 para incluir o ponto máximo

    return Math.min(
      100,
      Math.max(0, (pointsInCurrentLevel / pointsNeededForLevel) * 100),
    );
  }

  canAccess(points: number): boolean {
    return points >= this.minPoints && points <= this.maxPoints;
  }

  toString(): string {
    return `${this.name} (Level ${this.level})`;
  }

  toJSON() {
    return {
      level: this.level,
      name: this.name,
      min_points: this.minPoints,
      max_points: this.maxPoints,
      benefits: this.benefits,
    };
  }
}

export class InvalidUserLevelError extends Error {
  constructor(message?: string) {
    super(message || "Invalid user level");
    this.name = "InvalidUserLevelError";
  }
}
