import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
} from "@nestjs/common";
import { Response } from "express";
import { ValidationError } from "class-validator";

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let errors: any = exceptionResponse;

    // Handle class-validator errors
    if (typeof exceptionResponse === "object" && exceptionResponse["message"]) {
      const messages = exceptionResponse["message"];
      if (Array.isArray(messages)) {
        errors = {
          statusCode: status,
          message: "Validation failed",
          errors: messages,
        };
      }
    }

    response.status(status).json(errors);
  }
}
