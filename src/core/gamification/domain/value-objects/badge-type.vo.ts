import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { ValueObject } from "../../../shared/domain/value-object";

export enum BadgeTypeEnum {
  INICIANTE_MUSICAL = "iniciante_musical",
  SUGESTOR_CRIATIVO = "sugestor_criativo",
  ACERTADOR = "acertador",
  APOIADOR = "apoiador",
  MECENAS = "mecenas",
  SOCIALIZER = "socializer",
  DISCOVERER = "discoverer",
  SUPER_FA = "super_fa",
}

export class BadgeType extends ValueObject {
  constructor(readonly value: BadgeTypeEnum) {
    super();
    this.validate();
  }

  private validate(): void {
    if (!Object.values(BadgeTypeEnum).includes(this.value)) {
      throw new EntityValidationError([
        {
          badge_type: [`Invalid badge type: ${this.value}`],
        },
      ]);
    }
  }

  static create(value: string): BadgeType {
    return new BadgeType(value as BadgeTypeEnum);
  }

  static INICIANTE_MUSICAL(): BadgeType {
    return new BadgeType(BadgeTypeEnum.INICIANTE_MUSICAL);
  }

  static SUGESTOR_CRIATIVO(): BadgeType {
    return new BadgeType(BadgeTypeEnum.SUGESTOR_CRIATIVO);
  }

  static ACERTADOR(): BadgeType {
    return new BadgeType(BadgeTypeEnum.ACERTADOR);
  }

  static APOIADOR(): BadgeType {
    return new BadgeType(BadgeTypeEnum.APOIADOR);
  }

  static MECENAS(): BadgeType {
    return new BadgeType(BadgeTypeEnum.MECENAS);
  }

  static SOCIALIZER(): BadgeType {
    return new BadgeType(BadgeTypeEnum.SOCIALIZER);
  }

  static DISCOVERER(): BadgeType {
    return new BadgeType(BadgeTypeEnum.DISCOVERER);
  }

  static SUPER_FA(): BadgeType {
    return new BadgeType(BadgeTypeEnum.SUPER_FA);
  }

  getRequiredPoints(): number {
    const pointsMap = {
      [BadgeTypeEnum.INICIANTE_MUSICAL]: 100,
      [BadgeTypeEnum.SUGESTOR_CRIATIVO]: 500,
      [BadgeTypeEnum.ACERTADOR]: 1000,
      [BadgeTypeEnum.APOIADOR]: 2000,
      [BadgeTypeEnum.MECENAS]: 5000,
      [BadgeTypeEnum.SOCIALIZER]: 1500,
      [BadgeTypeEnum.DISCOVERER]: 3000,
      [BadgeTypeEnum.SUPER_FA]: 10000,
    };

    return pointsMap[this.value];
  }

  getDescription(): string {
    const descriptionMap = {
      [BadgeTypeEnum.INICIANTE_MUSICAL]: "Primeiros passos no mundo musical",
      [BadgeTypeEnum.SUGESTOR_CRIATIVO]: "Especialista em sugestões musicais",
      [BadgeTypeEnum.ACERTADOR]: "Acerta sempre nas sugestões",
      [BadgeTypeEnum.APOIADOR]: "Apoia músicos com gorjetas",
      [BadgeTypeEnum.MECENAS]: "Grande apoiador da música",
      [BadgeTypeEnum.SOCIALIZER]: "Compartilha e conecta pessoas",
      [BadgeTypeEnum.DISCOVERER]: "Descobre novos talentos",
      [BadgeTypeEnum.SUPER_FA]: "O maior fã da plataforma",
    };

    return descriptionMap[this.value];
  }

  toString(): string {
    return this.value;
  }

  equals(other: BadgeType): boolean {
    return this.value === other.value;
  }
}
