import { DomainError } from "../errors/domain.error";
import { InvalidArgumentError } from "../errors/invalid-argument.error";
import { FieldsErrors } from "./validator-fields-interface";

export abstract class BaseValidationError extends DomainError {
  constructor(
    public error: FieldsErrors[],
    message = "Validation Error",
    options?: {
      cause?: unknown;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, options);
  }

  count() {
    return Object.keys(this.error).length;
  }
}

export class ValidationError extends InvalidArgumentError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class EntityValidationError extends BaseValidationError {
  constructor(
    public error: FieldsErrors[],
    options?: {
      cause?: unknown;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(error, "Entity Validation Error", options);
    this.name = "EntityValidationError";
  }
}

export class SearchValidationError extends BaseValidationError {
  constructor(
    error: FieldsErrors[],
    options?: {
      cause?: unknown;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(error, "Search Validation Error", options);
    this.name = "SearchValidationError";
  }
}

export class LoadEntityError extends BaseValidationError {
  constructor(
    public error: FieldsErrors[],
    options?: {
      cause?: unknown;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(error, "LoadEntityError", options);
    this.name = "LoadEntityError";
  }
}
