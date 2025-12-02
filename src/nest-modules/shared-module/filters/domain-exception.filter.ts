import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";

// Base domain exception class
export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainException";
  }
}

// Specific domain exceptions
export class EntityValidationException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = "EntityValidationException";
  }
}

export class EntityNotFoundException extends DomainException {
  constructor(message: string) {
    super(message);
    this.name = "EntityNotFoundException";
  }
}

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.BAD_REQUEST;

    if (exception instanceof EntityNotFoundException) {
      status = HttpStatus.NOT_FOUND;
    } else if (exception instanceof EntityValidationException) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
    }

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      error: exception.name,
    });
  }
}
