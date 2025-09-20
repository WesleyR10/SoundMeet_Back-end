import request from "supertest";
import { IEstablishmentRepository } from "../../src/core/establishment/domain/establishment.repository";
import { ESTABLISHMENT_PROVIDERS } from "../../src/nest-modules/establishment-module/establishment.providers";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";
import { Uuid } from "../../src/core/shared/domain/value-objects/uuid.vo";
import { EstablishmentController } from "../../src/nest-modules/establishment-module/establishment.controller";
import { EstablishmentOutputMapper } from "../../src/core/establishment/application/use-cases/common/establishment-output";
import { instanceToPlain } from "class-transformer";
import { EstablishmentFakeBuilder } from "../../src/core/establishment/domain/establishment-fake.builder";

describe("EstablishmentController (e2e)", () => {
  const appHelper = startApp();
  let establishmentRepo: IEstablishmentRepository;

  beforeEach(async () => {
    establishmentRepo = appHelper.app.get<IEstablishmentRepository>(
      ESTABLISHMENT_PROVIDERS.REPOSITORIES.ESTABLISHMENT_REPOSITORY.provide,
    );
  });

  describe("/establishments/:id (PATCH)", () => {
    describe("unauthenticated", () => {
      const app = startApp();

      test("should return 401 when not authenticated", () => {
        const establishmentId = new Uuid();
        return request(app.app.getHttpServer())
          .patch(`/establishments/${establishmentId.id}`)
          .send({})
          .expect(401);
      });

      test("should return 403 when not authenticated as admin", () => {
        const establishmentId = new Uuid();
        return request(app.app.getHttpServer())
          .patch(`/establishments/${establishmentId.id}`)
          .authenticate(app.app, false)
          .send({})
          .expect(403);
      });
    });

    describe("should return a response error with 404 status code when id is not found", () => {
      const establishmentId = new Uuid();

      test("when id is not found", () => {
        return request(appHelper.app.getHttpServer())
          .patch(`/establishments/${establishmentId.id}`)
          .authenticate(appHelper.app)
          .send({})
          .expect(404)
          .expect({
            message: `Establishment Not Found using ID ${establishmentId.id}`,
            error: "Not Found",
            statusCode: 404,
          });
      });
    });

    describe("should return a response error with 422 status code when request body is invalid", () => {
      const invalidRequests = [
        {
          label: "name with wrong type",
          send_data: {
            name: 5,
          },
          expected: {
            message: ["name must be a string"],
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
            message: ["email must be an email"],
            error: "Unprocessable Entity",
            statusCode: 422,
          },
        },
      ];

      test.each(invalidRequests)(
        "when body is $label",
        async ({ send_data, expected }) => {
          const establishmentCreated =
            EstablishmentFakeBuilder.anEstablishment().build();
          await establishmentRepo.insert(establishmentCreated);
          return request(appHelper.app.getHttpServer())
            .patch(
              `/establishments/${establishmentCreated.establishment_id.id}`,
            )
            .authenticate(appHelper.app)
            .send(send_data)
            .expect(422)
            .expect(expected);
        },
      );
    });

    describe("should update an establishment", () => {
      const arrange = [
        {
          label: "name only",
          send_data: {
            name: "Updated Establishment Name",
          },
        },
        {
          label: "all fields",
          send_data: {
            name: "Complete Updated Establishment",
            description: "Updated description",
            avatar: "https://example.com/new-avatar.jpg",
            cnpj: "98.765.432/0001-10",
            phone: "+55 11 88888-8888",
            is_active: false,
            is_verified: true,
          },
        },
      ];

      test.each(arrange)("when body is $label", async ({ send_data }) => {
        const establishmentCreated =
          EstablishmentFakeBuilder.anEstablishment().build();
        await establishmentRepo.insert(establishmentCreated);

        const res = await request(appHelper.app.getHttpServer())
          .patch(`/establishments/${establishmentCreated.establishment_id.id}`)
          .authenticate(appHelper.app)
          .send(send_data)
          .expect(200);

        const keyInResponse = EstablishmentController.establishmentToResponse(
          res.body.data,
        );
        const establishmentUpdated = await establishmentRepo.findById(
          establishmentCreated.establishment_id,
        );
        const presenter = EstablishmentOutputMapper.toOutput(
          establishmentUpdated!,
        );
        const serialized = instanceToPlain(presenter);
        expect(keyInResponse).toStrictEqual(serialized);
        expect(res.body.data).toMatchObject({
          id: establishmentCreated.establishment_id.id,
          ...send_data,
        });
      });
    });
  });
});
