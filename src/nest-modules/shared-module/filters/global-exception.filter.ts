import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { Response } from "express";

import { ConflictError } from "../../../core/shared/domain/errors/conflict.error";
import { DomainError } from "../../../core/shared/domain/errors/domain.error";
import { ExternalServiceError } from "../../../core/shared/domain/errors/external-service.error";
import { InvalidArgumentError } from "../../../core/shared/domain/errors/invalid-argument.error";
import { InvalidOperationError } from "../../../core/shared/domain/errors/invalid-operation.error";
import { NotFoundError } from "../../../core/shared/domain/errors/not-found.error";
import { UnauthorizedError } from "../../../core/shared/domain/errors/unauthorized.error";
import { PlanLimitExceededError } from "../../../core/plans/domain/errors/plan-limit-exceeded.error";
import {
  BaseValidationError,
  EntityValidationError,
} from "../../../core/shared/domain/validators/validation.error";

function safeJsonStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function toLoggableCause(cause: unknown): unknown {
  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      stack: cause.stack,
    };
  }

  if (cause === undefined) {
    return undefined;
  }

  const json = safeJsonStringify(cause);
  if (json !== null) {
    return {
      value: json,
    };
  }

  return {
    value: String(cause),
  };
}

function toExceptionLogContext(exception: Error): Record<string, unknown> {
  if (exception instanceof DomainError) {
    const cause = (exception as any).cause;
    return {
      metadata: exception.metadata,
      cause: toLoggableCause(cause),
    };
  }

  const metadata = (exception as any)?.metadata;
  if (metadata && typeof metadata === "object") {
    const cause = (exception as any).cause;
    return {
      metadata,
      cause: toLoggableCause(cause),
    };
  }
  return {};
}

function getErrorText(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 402:
      return "Payment Required";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 409:
      return "Conflict";
    case 413:
      return "Payload Too Large";
    case 422:
      return "Unprocessable Entity";
    case 503:
      return "Service Unavailable";
    case 500:
    default:
      return "Internal Server Error";
  }
}

function toMessageArray(message: unknown): string[] {
  if (Array.isArray(message)) {
    return message.map((value) => String(value));
  }
  if (typeof message === "string") {
    return [message];
  }
  if (message === undefined || message === null) {
    return [];
  }
  return [String(message)];
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (response.headersSent) {
      return;
    }

    if (exception instanceof EntityValidationError) {
      response.status(422).json({
        statusCode: 422,
        error: getErrorText(422),
        message: toMessageArray(
          exception.error?.flatMap((e) => {
            if (typeof e === "string") return [e];
            return Object.values(e).flat();
          }),
        ),
      });
      return;
    }

    if (exception instanceof BaseValidationError) {
      response.status(422).json({
        statusCode: 422,
        error: getErrorText(422),
        message: toMessageArray(
          exception.error?.flatMap((e) => {
            if (typeof e === "string") return [e];
            return Object.values(e).flat();
          }),
        ),
      });
      return;
    }

    if (exception instanceof NotFoundError) {
      response.status(404).json({
        statusCode: 404,
        error: getErrorText(404),
        message: [exception.message],
      });
      return;
    }

    if (exception instanceof UnauthorizedError) {
      response.status(401).json({
        statusCode: 401,
        error: getErrorText(401),
        message: [exception.message],
      });
      return;
    }

    if (exception instanceof PlanLimitExceededError) {
      response.status(402).json({
        statusCode: 402,
        error: getErrorText(402),
        message: [exception.message],
      });
      return;
    }

    if (exception instanceof ConflictError) {
      response.status(409).json({
        statusCode: 409,
        error: getErrorText(409),
        message: [exception.message],
      });
      return;
    }

    if (exception instanceof InvalidArgumentError) {
      response.status(422).json({
        statusCode: 422,
        error: getErrorText(422),
        message: [exception.message],
      });
      return;
    }

    if (exception instanceof InvalidOperationError) {
      response.status(422).json({
        statusCode: 422,
        error: getErrorText(422),
        message: [exception.message],
      });
      return;
    }

    if (exception instanceof ExternalServiceError) {
      console.error(
        "GlobalExceptionFilter external service error",
        JSON.stringify({
          message: exception.message,
          ...toExceptionLogContext(exception),
        }),
      );
      response.status(503).json({
        statusCode: 503,
        error: getErrorText(503),
        message: [exception.message],
      });
      return;
    }

    if (exception instanceof Error) {
      if (
        exception.name.startsWith("Invalid") &&
        exception.name.endsWith("Error")
      ) {
        response.status(422).json({
          statusCode: 422,
          error: getErrorText(422),
          message: [exception.message],
        });
        return;
      }
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse() as any;
      const message =
        typeof payload === "string"
          ? [payload]
          : toMessageArray(payload?.message ?? exception.message);

      response.status(statusCode).json({
        statusCode,
        error: getErrorText(statusCode),
        message,
      });
      return;
    }

    const isDevelopment = process.env.NODE_ENV !== "production";

    if (exception instanceof Error) {
      const rawMessage =
        (exception as any)?.message == null
          ? ""
          : String((exception as any).message);
      const normalizedMessage = rawMessage.toLowerCase();

      const payloadTooLarge =
        (exception as any)?.status === 413 ||
        (exception as any)?.statusCode === 413 ||
        normalizedMessage.includes("request entity too large") ||
        normalizedMessage.includes("entity too large");

      if (payloadTooLarge) {
        const message = isDevelopment
          ? ["Request entity too large", exception.message]
          : ["Request entity too large"];

        console.error(
          "GlobalExceptionFilter payload too large",
          JSON.stringify({
            name: exception.name,
            message: exception.message,
            ...toExceptionLogContext(exception),
          }),
        );

        response.status(413).json({
          statusCode: 413,
          error: getErrorText(413),
          message,
        });
        return;
      }

      console.error(
        "GlobalExceptionFilter unexpected error",
        JSON.stringify({
          name: exception.name,
          message: exception.message,
          stack: exception.stack,
          ...toExceptionLogContext(exception),
        }),
      );
      // Único ponto de captura no filtro: só chega aqui o que não é um dos
      // DomainError/HttpException já tratados acima — ou seja, bug de
      // verdade, não resultado de negócio esperado (404/422/402/409/503).
      Sentry.captureException(exception);
    } else {
      console.error(
        "GlobalExceptionFilter non-error throw",
        JSON.stringify({
          value: safeJsonStringify(exception) ?? String(exception),
        }),
      );
      Sentry.captureException(exception);
    }
    response.status(500).json({
      statusCode: 500,
      error: getErrorText(500),
      message: ["Internal server error"],
    });
  }
}
