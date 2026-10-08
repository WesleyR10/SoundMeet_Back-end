import { Controller, Get, INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { PlanLimitExceededError } from "../../../core/plans/domain/errors/plan-limit-exceeded.error";
import { DomainError } from "../../../core/shared/domain/errors/domain.error";
import { InvalidArgumentError } from "../../../core/shared/domain/errors/invalid-argument.error";
import { InvalidUuidError } from "../../../core/shared/domain/value-objects/uuid.vo";
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

  /*
   * O Multer lança isto quando o arquivo passa do `limits.fileSize`. Não é
   * HttpException nem DomainError: antes deste ramo no filtro, um upload
   * grande demais virava 500 "erro inesperado" + alerta no Sentry — o usuário
   * sem saber que bastava mandar um arquivo menor, e o monitoramento
   * contabilizando regra de negócio como defeito de servidor.
   */
  @Get("multer-too-large")
  multerTooLarge() {
    const error = new Error("File too large");
    error.name = "MulterError";
    (error as any).code = "LIMIT_FILE_SIZE";
    throw error;
  }

  @Get("multer-other")
  multerOther() {
    const error = new Error("Unexpected field");
    error.name = "MulterError";
    (error as any).code = "LIMIT_UNEXPECTED_FILE";
    throw error;
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

  it("mapeia MulterError de tamanho para 413, não para o 500 genérico", async () => {
    const response = await request(app.getHttpServer())
      .get("/stub-global-exception-filter/multer-too-large")
      .expect(413);

    expect(response.body.error).toBe("Payload Too Large");
    expect(response.body.message[0]).toContain("grande demais");
  });

  it("mapeia os demais MulterError para 422", async () => {
    const response = await request(app.getHttpServer())
      .get("/stub-global-exception-filter/multer-other")
      .expect(422);

    expect(response.body.message[0]).toContain("LIMIT_UNEXPECTED_FILE");
  });
});
