import { Entity } from "../entity";
import { DomainError } from "./domain.error";

export class NotFoundError extends DomainError {
  constructor(
    id: any[] | any,
    entityClass: new (...args: any[]) => Entity,
    options?: {
      cause?: unknown;
      metadata?: Record<string, unknown>;
    },
  ) {
    const idsMessage = Array.isArray(id) ? id.join(", ") : id;
    super(`${entityClass.name} Not Found using ID ${idsMessage}`, {
      ...options,
      metadata: {
        entity: entityClass.name,
        id: idsMessage,
        ...(options?.metadata ?? {}),
      },
    });
  }
}
