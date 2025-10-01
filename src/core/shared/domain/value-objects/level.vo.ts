import { ValueObject } from "../value-object";

export type LevelProps = {
  value: number;
  name: string;
  minPoints: number;
  maxPoints: number;
  benefits: string[];
};

export class Level extends ValueObject {
  readonly value: number;
  readonly name: string;
  readonly minPoints: number;
  readonly maxPoints: number;
  readonly benefits: string[];

  constructor(props: LevelProps) {
    super();
    this.value = props.value;
    this.name = props.name;
    this.minPoints = props.minPoints;
    this.maxPoints = props.maxPoints;
    this.benefits = props.benefits;
    this.validate();
  }

  private validate(): void {
    if (this.value < 1) {
      throw new InvalidLevelError("Level value must be greater than 0");
    }

    if (!this.name || this.name.trim().length === 0) {
      throw new InvalidLevelError("Level name is required");
    }

    if (this.minPoints < 0) {
      throw new InvalidLevelError(
        "Min points must be greater than or equal to 0",
      );
    }

    if (this.maxPoints <= this.minPoints) {
      throw new InvalidLevelError("Max points must be greater than min points");
    }

    if (!Array.isArray(this.benefits)) {
      throw new InvalidLevelError("Benefits must be an array");
    }
  }

  static fromPoints(points: number): Level {
    const levels = [
      {
        value: 1,
        name: "Novato",
        minPoints: 0,
        maxPoints: 99,
        benefits: ["Acesso básico"],
      },
      {
        value: 2,
        name: "Fã",
        minPoints: 100,
        maxPoints: 299,
        benefits: ["Acesso básico", "Notificações prioritárias"],
      },
      {
        value: 3,
        name: "Entusiasta",
        minPoints: 300,
        maxPoints: 599,
        benefits: [
          "Acesso básico",
          "Notificações prioritárias",
          "Desconto 5% em gorjetas",
        ],
      },
      {
        value: 4,
        name: "Apoiador",
        minPoints: 600,
        maxPoints: 999,
        benefits: [
          "Acesso básico",
          "Notificações prioritárias",
          "Desconto 10% em gorjetas",
          "Acesso antecipado",
        ],
      },
      {
        value: 5,
        name: "VIP",
        minPoints: 1000,
        maxPoints: 1999,
        benefits: [
          "Acesso básico",
          "Notificações prioritárias",
          "Desconto 15% em gorjetas",
          "Acesso antecipado",
          "Conteúdo exclusivo",
        ],
      },
      {
        value: 6,
        name: "Super Fã",
        minPoints: 2000,
        maxPoints: 4999,
        benefits: [
          "Acesso básico",
          "Notificações prioritárias",
          "Desconto 20% em gorjetas",
          "Acesso antecipado",
          "Conteúdo exclusivo",
          "Meet & Greet",
        ],
      },
      {
        value: 7,
        name: "Lenda",
        minPoints: 5000,
        maxPoints: Number.MAX_SAFE_INTEGER,
        benefits: [
          "Todos os benefícios anteriores",
          "Acesso VIP exclusivo",
          "Participação em decisões",
        ],
      },
    ];

    const level = levels.find(
      (l) => points >= l.minPoints && points <= l.maxPoints,
    );

    if (!level) {
      return new Level(levels[0]);
    }

    return new Level(level);
  }

  static create(
    value: number,
    name: string,
    minPoints: number,
    maxPoints: number,
    benefits: string[],
  ): Level {
    return new Level({
      value,
      name,
      minPoints,
      maxPoints,
      benefits,
    });
  }

  getProgressToNextLevel(currentPoints: number): number {
    if (currentPoints >= this.maxPoints) {
      return 100;
    }

    const progress =
      ((currentPoints - this.minPoints) / (this.maxPoints - this.minPoints)) *
      100;
    return Math.max(0, Math.min(100, progress));
  }

  getPointsToNextLevel(currentPoints: number): number {
    if (currentPoints >= this.maxPoints) {
      return 0;
    }

    return this.maxPoints - currentPoints + 1;
  }

  isMaxLevel(): boolean {
    return this.maxPoints === Number.MAX_SAFE_INTEGER;
  }

  hasBenefit(benefit: string): boolean {
    return this.benefits.includes(benefit);
  }

  toJSON() {
    return {
      value: this.value,
      name: this.name,
      minPoints: this.minPoints,
      maxPoints: this.maxPoints,
      benefits: this.benefits,
      isMaxLevel: this.isMaxLevel(),
    };
  }
}

export class InvalidLevelError extends Error {
  constructor(message?: string) {
    super(message || "Invalid level");
    this.name = "InvalidLevelError";
  }
}
