import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { WrapperDataInterceptor } from "./shared-module/interceptors/wrapper-data/wrapper-data.interceptor";

export function applyGlobalConfig(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      errorHttpStatusCode: 422,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(
    new WrapperDataInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );
  // app.useGlobalFilters(
  //   new EntityValidationErrorFilter(),
  //   new NotFoundErrorFilter(),
  // );
}
