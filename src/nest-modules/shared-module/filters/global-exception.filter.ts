import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { Response } from "express";

import { ConflictError } from "../../../core/shared/domain/errors/conflict.error";
import { InvalidArgumentError } from "../../../core/shared/domain/errors/invalid-argument.error";
import { NotFoundError } from "../../../core/shared/domain/errors/not-found.error";
import {
  BaseValidationError,
  EntityValidationError,
} from "../../../core/shared/domain/validators/validation.error";

function getErrorText(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 409:
      return "Conflict";
    case 422:
      return "Unprocessable Entity";
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

    response.status(500).json({
      statusCode: 500,
      error: getErrorText(500),
      message: ["Internal server error"],
    });
  }
}
