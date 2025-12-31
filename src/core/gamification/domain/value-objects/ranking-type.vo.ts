import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { ValueObject } from "../../../shared/domain/value-object";

export enum RankingTypeEnum {
  TOP_FAS = "top_fas",
  TOP_SUGESTOES = "top_sugestoes",
  TOP_APOIADORES = "top_apoiadores",
  TOP_DISCOVERERS = "top_discoverers",
  TOP_MUSICOS = "top_musicos",
  TOP_ESTABELECIMENTOS = "top_estabelecimentos",
}

export enum RankingPeriodEnum {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  YEARLY = "yearly",
  ALL_TIME = "all_time",
}

export class RankingType extends ValueObject {
  constructor(readonly value: RankingTypeEnum) {
    super();
    this.validate();
  }

  private validate(): void {
    if (!Object.values(RankingTypeEnum).includes(this.value)) {
      throw new EntityValidationError([
        {
          ranking_type: [`Invalid ranking type: ${this.value}`],
        },
      ]);
    }
  }

  static create(value: string): RankingType {
    return new RankingType(value as RankingTypeEnum);
  }

  static TOP_FAS(): RankingType {
    return new RankingType(RankingTypeEnum.TOP_FAS);
  }

  static TOP_SUGESTOES(): RankingType {
    return new RankingType(RankingTypeEnum.TOP_SUGESTOES);
  }

  static TOP_APOIADORES(): RankingType {
    return new RankingType(RankingTypeEnum.TOP_APOIADORES);
  }

  static TOP_DISCOVERERS(): RankingType {
    return new RankingType(RankingTypeEnum.TOP_DISCOVERERS);
  }

  static TOP_MUSICOS(): RankingType {
    return new RankingType(RankingTypeEnum.TOP_MUSICOS);
  }

  static TOP_ESTABELECIMENTOS(): RankingType {
    return new RankingType(RankingTypeEnum.TOP_ESTABELECIMENTOS);
  }

  getDescription(): string {
    const descriptionMap = {
      [RankingTypeEnum.TOP_FAS]: "Maiores fãs da plataforma",
      [RankingTypeEnum.TOP_SUGESTOES]: "Melhores sugestões musicais",
      [RankingTypeEnum.TOP_APOIADORES]: "Maiores apoiadores com gorjetas",
      [RankingTypeEnum.TOP_DISCOVERERS]: "Descobridores de novos talentos",
      [RankingTypeEnum.TOP_MUSICOS]: "Músicos mais populares",
      [RankingTypeEnum.TOP_ESTABELECIMENTOS]: "Estabelecimentos mais ativos",
    };

    return descriptionMap[this.value];
  }

  toString(): string {
    return this.value;
  }

  equals(other: RankingType): boolean {
    return this.value === other.value;
  }
}

export class RankingPeriod extends ValueObject {
  constructor(readonly value: RankingPeriodEnum) {
    super();
    this.validate();
  }

  private validate(): void {
    if (!Object.values(RankingPeriodEnum).includes(this.value)) {
      throw new Error(`Invalid ranking period: ${this.value}`);
    }
  }

  static create(value: string): RankingPeriod {
    return new RankingPeriod(value as RankingPeriodEnum);
  }

  static DAILY(): RankingPeriod {
    return new RankingPeriod(RankingPeriodEnum.DAILY);
  }

  static WEEKLY(): RankingPeriod {
    return new RankingPeriod(RankingPeriodEnum.WEEKLY);
  }

  static MONTHLY(): RankingPeriod {
    return new RankingPeriod(RankingPeriodEnum.MONTHLY);
  }

  static YEARLY(): RankingPeriod {
    return new RankingPeriod(RankingPeriodEnum.YEARLY);
  }

  static ALL_TIME(): RankingPeriod {
    return new RankingPeriod(RankingPeriodEnum.ALL_TIME);
  }

  toString(): string {
    return this.value;
  }

  equals(other: RankingPeriod): boolean {
    return this.value === other.value;
  }
}
