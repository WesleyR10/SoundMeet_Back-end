import { DomainError } from "../../../shared/domain/errors/domain.error";

export class PlanLimitExceededError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
