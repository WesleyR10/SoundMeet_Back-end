import { InvariantViolationError } from "./invariant-violation.error";

export class InvalidDateTimeError extends InvariantViolationError {
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
