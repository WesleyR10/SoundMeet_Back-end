import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { Response } from "express";
import { union } from "lodash";

import { EntityValidationError } from "../../../core/shared/domain/validators/validation.error";

@Catch(EntityValidationError)
export class EntityValidationErrorFilter implements ExceptionFilter {
  catch(exception: EntityValidationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const message = union(
      ...exception.error.reduce((acc, error) => {
        if (typeof error === "string") {
          return acc.concat([[error]]);
        }
        const grouped = Object.values(error).reduce(
          (subAcc, fieldErrors) => subAcc.concat(fieldErrors),
          [] as string[],
        );
        return acc.concat([grouped]);
      }, [] as string[][]),
    );

    response.status(422).json({
      statusCode: 422,
      error: "Unprocessable Entity",
      message,
    });
  }
}
