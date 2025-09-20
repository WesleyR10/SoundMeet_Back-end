import request from "supertest";
import { IEstablishmentRepository } from "../../src/core/establishment/domain/establishment.repository";
import { ESTABLISHMENT_PROVIDERS } from "../../src/nest-modules/establishment-module/establishment.providers";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";
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

  describe("/establishments (GET)", () => {
    describe("unauthenticated", () => {
      const app = startApp();

      test("should return 401 when not authenticated", () => {
        return request(app.app.getHttpServer())
          .get("/establishments")
          .expect(401);
      });

      test("should return 403 when not authenticated as admin", () => {
        return request(app.app.getHttpServer())
          .get("/establishments")
          .authenticate(app.app, false)
          .expect(403);
      });
    });

    describe("should return establishments ordered by created_at when request query is empty", () => {
      test("when no establishments exist", async () => {
        const res = await request(appHelper.app.getHttpServer())
          .get("/establishments")
          .authenticate(appHelper.app)
          .expect(200);

        expect(res.body.data).toHaveLength(0);
        expect(res.body.meta).toEqual({
          current_page: 1,
          last_page: 0,
          per_page: 15,
          total: 0,
        });
      });

      test("when establishments exist", async () => {
        const establishmentsCreated =
          EstablishmentFakeBuilder.theEstablishments(3)
            .withName((index) => `Establishment ${index}`)
            .withcreated_at(
              (index) => new Date(new Date().getTime() + index * 1000),
            )
            .build();

        await establishmentRepo.bulkInsert(establishmentsCreated);

        const res = await request(appHelper.app.getHttpServer())
          .get("/establishments")
          .authenticate(appHelper.app)
          .expect(200);

        const keyInResponse = res.body.data.map((item: any) =>
          EstablishmentController.establishmentToResponse(item),
        );
        const establishmentsOrdered = establishmentsCreated.slice().reverse();
        const presenter = establishmentsOrdered.map((establishment) =>
          EstablishmentOutputMapper.toOutput(establishment),
        );
        const serialized = presenter.map((item) => instanceToPlain(item));
        expect(keyInResponse).toStrictEqual(serialized);
        expect(res.body.meta).toEqual({
          current_page: 1,
          last_page: 1,
          per_page: 15,
          total: 3,
        });
      });
    });

    describe("should return establishments using pagination, filter and sort", () => {
      const establishmentsCreated = EstablishmentFakeBuilder.theEstablishments(
        5,
      )
        .withName((index) => `Establishment ${index}`)
        .build();

      beforeEach(async () => {
        await establishmentRepo.bulkInsert(establishmentsCreated);
      });

      test("when using pagination", async () => {
        const res = await request(appHelper.app.getHttpServer())
          .get("/establishments")
          .query({ page: 1, per_page: 2 })
          .authenticate(appHelper.app)
          .expect(200);

        expect(res.body.data).toHaveLength(2);
        expect(res.body.meta).toEqual({
          current_page: 1,
          last_page: 3,
          per_page: 2,
          total: 5,
        });
      });

      test("when using filter", async () => {
        const res = await request(appHelper.app.getHttpServer())
          .get("/establishments")
          .query({ filter: "Establishment 1" })
          .authenticate(appHelper.app)
          .expect(200);

        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].name).toBe("Establishment 1");
      });

      test("when using sort", async () => {
        const res = await request(appHelper.app.getHttpServer())
          .get("/establishments")
          .query({ sort: "name", sort_dir: "asc" })
          .authenticate(appHelper.app)
          .expect(200);

        const names = res.body.data.map((item: any) => item.name);
        expect(names).toEqual([
          "Establishment 0",
          "Establishment 1",
          "Establishment 2",
          "Establishment 3",
          "Establishment 4",
        ]);
      });
    });
  });
});
