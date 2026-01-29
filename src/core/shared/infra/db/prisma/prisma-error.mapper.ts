import { Entity } from "../../../domain/entity";
import { ConflictError } from "../../../domain/errors/conflict.error";
import { DomainError } from "../../../domain/errors/domain.error";
import { InvalidArgumentError } from "../../../domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../domain/errors/not-found.error";

export type PrismaErrorContext = {
  entityClass?: new (...args: any[]) => Entity;
  id?: unknown;
  operation?: string;
};

export function mapPrismaErrorToDomainError(
  error: any,
  context: PrismaErrorContext = {},
): DomainError {
  if (error instanceof DomainError) {
    return error;
  }

  const code = error?.code;
  if (typeof code !== "string") {
    return new DomainError("Database error", {
      cause: error,
      metadata: {
        operation: context.operation,
        entity: context.entityClass?.name,
        id: context.id,
      },
    });
  }

  if (code === "P2025" && context.entityClass && context.id != null) {
    return new NotFoundError(context.id, context.entityClass, {
      cause: error,
      metadata: {
        operation: context.operation,
      },
    });
  }

  if (code === "P2002") {
    const target = error?.meta?.target;
    return new ConflictError("Unique constraint violation", {
      cause: error,
      metadata: {
        operation: context.operation,
        target,
      },
    });
  }

  if (code === "P2003") {
    const fieldName = error?.meta?.field_name;
    return new InvalidArgumentError("Foreign key constraint violation", {
      cause: error,
      metadata: {
        operation: context.operation,
        field_name: fieldName,
      },
    });
  }

  if (code === "P2000") {
    const columnName = error?.meta?.column_name;
    return new InvalidArgumentError("Value too long for column", {
      cause: error,
      metadata: {
        operation: context.operation,
        column_name: columnName,
      },
    });
  }

  if (code === "P2011") {
    const constraint = error?.meta?.constraint;
    return new InvalidArgumentError("Null constraint violation", {
      cause: error,
      metadata: {
        operation: context.operation,
        constraint,
      },
    });
  }

  return new DomainError("Database error", {
    cause: error,
    metadata: {
      operation: context.operation,
      entity: context.entityClass?.name,
      id: context.id,
      code,
    },
  });
}
