import { Uuid } from "../../../shared/domain/value-objects/uuid.vo";

export class GamificationId extends Uuid {
  constructor(id?: string) {
    super(id);
  }

  static create(id?: string): GamificationId {
    return new GamificationId(id);
  }
}

export class UserScoreId extends Uuid {
  constructor(id?: string) {
    super(id);
  }

  static create(id?: string): UserScoreId {
    return new UserScoreId(id);
  }
}

export class UserBadgeId extends Uuid {
  constructor(id?: string) {
    super(id);
  }

  static create(id?: string): UserBadgeId {
    return new UserBadgeId(id);
  }
}

export class RankingId extends Uuid {
  constructor(id?: string) {
    super(id);
  }

  static create(id?: string): RankingId {
    return new RankingId(id);
  }
}

export class UserInteractionId extends Uuid {
  constructor(id?: string) {
    super(id);
  }

  static create(id?: string): UserInteractionId {
    return new UserInteractionId(id);
  }
}
