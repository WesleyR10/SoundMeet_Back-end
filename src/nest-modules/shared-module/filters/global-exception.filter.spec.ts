import { Controller, Get, INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { DomainError } from "../../../core/shared/domain/errors/domain.error";
import { InvalidArgumentError } from "../../../core/shared/domain/errors/invalid-argument.error";
import { InvalidUuidError } from "../../../core/shared/domain/value-objects/uuid.vo";
import { PlanLimitExceededError } from "../../../core/plans/domain/errors/plan-limit-exceeded.error";
import { GlobalExceptionFilter } from "./global-exception.filter";

@Controller("stub-global-exception-filter")
class StubController {
  @Get("invalid-argument")
  invalidArgument() {
    throw new InvalidArgumentError("invalid");
  }

  @Get("invalid-uuid")
  invalidUuid() {
    throw new InvalidUuidError();
  }

  @Get("plan-limit")
  planLimit() {
    throw new PlanLimitExceededError("Recurso disponível apenas no plano PRO");
  }

  @Get("unexpected")
  unexpected() {
    throw new DomainError("boom");
  }
}

describe("GlobalExceptionFilter Unit Tests", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [StubController],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  it("should map InvalidArgumentError to 400", () => {
    return request(app.getHttpServer())
      .get("/stub-global-exception-filter/invalid-argument")
      .expect(422)
      .expect({
        statusCode: 422,
        error: "Unprocessable Entity",
        message: ["invalid"],
      });
  });

  it("should map Invalid*Error to 422", () => {
    return request(app.getHttpServer())
      .get("/stub-global-exception-filter/invalid-uuid")
      .expect(422)
      .expect({
        statusCode: 422,
        error: "Unprocessable Entity",
        message: ["ID must be a valida UUID"],
      });
  });

  it("should map PlanLimitExceededError to 402", () => {
    return request(app.getHttpServer())
      .get("/stub-global-exception-filter/plan-limit")
      .expect(402)
      .expect({
        statusCode: 402,
        error: "Payment Required",
        message: ["Recurso disponível apenas no plano PRO"],
      });
  });

  it("should map unknown errors to 500 without leaking message", () => {
    return request(app.getHttpServer())
      .get("/stub-global-exception-filter/unexpected")
      .expect(500)
      .expect({
        statusCode: 500,
        error: "Internal Server Error",
        message: ["Internal server error"],
      });
  });
});
