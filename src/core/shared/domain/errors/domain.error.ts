export type DomainErrorMetadata = Record<string, unknown>;

export class DomainError extends Error {
  readonly metadata: DomainErrorMetadata;
  readonly cause?: unknown;

  constructor(
    message: string,
    options?: {
      cause?: unknown;
      metadata?: DomainErrorMetadata;
    },
  ) {
    super(message);
    this.name = this.constructor.name;
    this.metadata = options?.metadata ?? {};
    this.cause = options?.cause;
  }
}
