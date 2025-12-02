import request from "supertest";
import { IEstablishmentRepository } from "../../src/core/establishment/domain/establishment.repository";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";
import { Uuid } from "../../src/core/shared/domain/value-objects/uuid.vo";
import { EstablishmentOutputMapper } from "../../src/core/establishment/application/use-cases/common/establishment-output";
import { instanceToPlain } from "class-transformer";
import { EstablishmentController } from "src/nest-modules/establishment-module/establishment.controller";
import { ESTABLISHMENT_PROVIDERS } from "src/nest-modules/establishment-module/establishment.providers";

describe("EstablishmentController (e2e)", () => {
  const appHelper = startApp();
  let establishmentRepo: IEstablishmentRepository;

  beforeEach(async () => {
    establishmentRepo = appHelper.app.get<IEstablishmentRepository>(
      ESTABLISHMENT_PROVIDERS.REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide,
    );
  });

  describe("/establishments (POST)", () => {
    describe("unauthenticated", () => {
      const app = startApp();

      test("should return 401 when not authenticated", () => {
        return request(app.app.getHttpServer())
          .post("/establishments")
          .send({})
          .expect(401);
      });

      test("should return 403 when not authenticated as admin", () => {
        return request(app.app.getHttpServer())
          .post("/establishments")
          .authenticate(app.app, false)
          .send({})
          .expect(403);
      });
    });

    describe("should return a response error with 422 status code when request body is invalid", () => {
      const invalidRequests = [
        {
          label: "empty body",
          send_data: {},
          expected: {
            message: [
              "email should not be empty",
              "email must be an email",
              "name should not be empty",
              "name must be a string",
            ],
            error: "Unprocessable Entity",
            statusCode: 422,
          },
        },
        {
          label: "name with wrong type",
          send_data: {
            name: 5,
          },
          expected: {
            message: [
              "email should not be empty",
              "email must be an email",
              "name must be a string",
            ],
            error: "Unprocessable Entity",
            statusCode: 422,
          },
        },
        {
          label: "email with wrong type",
          send_data: {
            email: 5,
          },
          expected: {
            message: [
              "email must be an email",
              "name should not be empty",
              "name must be a string",
            ],
            error: "Unprocessable Entity",
            statusCode: 422,
          },
        },
      ];

      test.each(invalidRequests)(
        "when body is $label",
        ({ send_data, expected }) => {
          return request(appHelper.app.getHttpServer())
            .post("/establishments")
            .authenticate(appHelper.app)
            .send(send_data)
            .expect(422)
            .expect(expected);
        },
      );
    });

    describe("should create an establishment", () => {
      const arrange = [
        {
          label: "only required fields",
          send_data: {
            email: "test@establishment.com",
            name: "Test Establishment",
          },
        },
        {
          label: "with all fields",
          send_data: {
            email: "complete@establishment.com",
            name: "Complete Establishment",
            description: "A complete establishment for testing",
            avatar: "https://example.com/avatar.jpg",
            cnpj: "12.345.678/0001-90",
            phone: "+55 11 99999-9999",
            is_active: true,
          },
        },
      ];

      test.each(arrange)("when body is $label", async ({ send_data }) => {
        const res = await request(appHelper.app.getHttpServer())
          .post("/establishments")
          .authenticate(appHelper.app)
          .send(send_data)
          .expect(201);

        const keyInResponse = EstablishmentController.establishmentToResponse(
          res.body.data,
        );
        const establishmentCreated = await establishmentRepo.findById(
          new Uuid(res.body.data.id),
        );
        const presenter = EstablishmentOutputMapper.toOutput(
          establishmentCreated!,
        );
        const serialized = instanceToPlain(presenter);
        expect(keyInResponse).toStrictEqual(serialized);
        expect(res.body.data).toMatchObject({
          id: establishmentCreated!.id.id,
          email: send_data.email,
          name: send_data.name,
          description: send_data.description ?? null,
          avatar: send_data.avatar ?? null,
          cnpj: send_data.cnpj ?? null,
          phone: send_data.phone ?? null,
          is_active: send_data.is_active ?? true,
          is_verified: false,
          created_at: establishmentCreated!.created_at,
        });
      });
    });
  });
});
