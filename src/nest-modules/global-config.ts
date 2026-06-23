import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { GlobalExceptionFilter } from "./shared-module/filters/global-exception.filter";
import { NotFoundErrorFilter } from "./shared-module/filters/not-found-error.filter";
import { WrapperDataInterceptor } from "./shared-module/interceptors/wrapper-data/wrapper-data.interceptor";

export function applyGlobalConfig(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      errorHttpStatusCode: 422,
      transform: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalInterceptors(
    new WrapperDataInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );
  app.useGlobalFilters(new NotFoundErrorFilter(), new GlobalExceptionFilter());
}
