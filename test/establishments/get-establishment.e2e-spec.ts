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

  describe("/establishments/:id (GET)", () => {
    describe("unauthenticated", () => {
      const app = startApp();

      test("should return 401 when not authenticated", () => {
        const establishmentId = new Uuid();
        return request(app.app.getHttpServer())
          .get(`/establishments/${establishmentId.id}`)
          .expect(401);
      });

      test("should return 403 when not authenticated as admin", () => {
        const establishmentId = new Uuid();
        return request(app.app.getHttpServer())
          .get(`/establishments/${establishmentId.id}`)
          .authenticate(app.app, false)
          .expect(403);
      });
    });

    describe("should return a response error with 404 status code when id is not found", () => {
      const establishmentId = new Uuid();

      test("when id is not found", () => {
        return request(appHelper.app.getHttpServer())
          .get(`/establishments/${establishmentId.id}`)
          .authenticate(appHelper.app)
          .expect(404)
          .expect({
            message: `Establishment Not Found using ID ${establishmentId.id}`,
            error: "Not Found",
            statusCode: 404,
          });
      });
    });

    describe("should return an establishment", () => {
      test("when establishment exists", async () => {
        const establishmentCreated =
          EstablishmentFakeBuilder.anEstablishment().build();
        await establishmentRepo.insert(establishmentCreated);

        const res = await request(appHelper.app.getHttpServer())
          .get(`/establishments/${establishmentCreated.establishment_id.id}`)
          .authenticate(appHelper.app)
          .expect(200);

        const keyInResponse = EstablishmentController.establishmentToResponse(
          res.body.data,
        );
        const presenter =
          EstablishmentOutputMapper.toOutput(establishmentCreated);
        const serialized = instanceToPlain(presenter);
        expect(keyInResponse).toStrictEqual(serialized);
      });
    });
  });
});
