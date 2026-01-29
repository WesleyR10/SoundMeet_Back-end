import { DomainError } from "./domain.error";

export class InvalidOperationError extends DomainError {
  constructor(
    message: string,
    options?: {
      cause?: unknown;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, options);
  }
}
