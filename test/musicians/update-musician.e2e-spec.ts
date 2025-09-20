import request from "supertest";
import { IMusicianRepository } from "../../src/core/musician/domain/musician.repository";
import { MUSICIAN_PROVIDERS } from "../../src/nest-modules/musician-module/musician.providers";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";
import { Uuid } from "../../src/core/shared/domain/value-objects/uuid.vo";
import { MusicianController } from "../../src/nest-modules/musician-module/musician.controller";
import { MusicianOutputMapper } from "../../src/core/musician/application/use-cases/common/musician-output";
import { instanceToPlain } from "class-transformer";
import { Musician } from "../../src/core/musician/domain/musician.aggregate";

describe("MusicianController (e2e)", () => {
  const appHelper = startApp();
  let musicianRepo: IMusicianRepository;

  beforeEach(async () => {
    musicianRepo = appHelper.app.get<IMusicianRepository>(
      MUSICIAN_PROVIDERS.REPOSITORIES.MUSICIAN_REPOSITORY.provide,
    );
  });

  describe("/musicians/:id (PUT)", () => {
    describe("unauthenticated", () => {
      const app = startApp();

      test("should return 401 when not authenticated", () => {
        const musicianId = new Uuid();
        return request(app.app.getHttpServer())
          .put(`/musicians/${musicianId.id}`)
          .send({})
          .expect(401);
      });

      test("should return 403 when not authenticated as admin", () => {
        const musicianId = new Uuid();
        return request(app.app.getHttpServer())
          .put(`/musicians/${musicianId.id}`)
          .authenticate(app.app, false)
          .send({})
          .expect(403);
      });
    });

    test("should return a response error with 422 status code when id is not valid", () => {
      return request(appHelper.app.getHttpServer())
        .put("/musicians/fake-id")
        .authenticate(appHelper.app)
        .send({})
        .expect(422)
        .expect({
          message: "Validation failed (uuid is expected)",
          error: "Bad Request",
          statusCode: 422,
        });
    });

    test("should return a response error with 404 status code when musician is not found", () => {
      const musicianId = new Uuid();
      return request(appHelper.app.getHttpServer())
        .put(`/musicians/${musicianId.id}`)
        .authenticate(appHelper.app)
        .send({
          name: "Updated Name",
        })
        .expect(404)
        .expect({
          message: `Musician not found using ID ${musicianId.id}`,
          error: "Not Found",
          statusCode: 404,
        });
    });

    describe("should return a response error with 422 status code when request body is invalid", () => {
      const invalidRequests = [
        {
          label: "invalid email",
          send_data: {
            email: "invalid-email",
          },
          expected: {
            message: ["email must be an email"],
            error: "Bad Request",
            statusCode: 422,
          },
        },
        {
          label: "empty name",
          send_data: {
            name: "",
          },
          expected: {
            message: ["name should not be empty"],
            error: "Bad Request",
            statusCode: 422,
          },
        },
        {
          label: "invalid experience years",
          send_data: {
            experience_years: -1,
          },
          expected: {
            message: ["experience_years must not be less than 0"],
            error: "Bad Request",
            statusCode: 422,
          },
        },
      ];

      test.each(invalidRequests)(
        "when body is $label",
        async ({ send_data, expected }) => {
          const musician = Musician.create({
            email: "test@example.com",
            name: "Test Musician",
            genres: ["Rock"],
            instruments: ["Guitar"],
          });
          await musicianRepo.insert(musician);

          return request(appHelper.app.getHttpServer())
            .put(`/musicians/${musician.id.id}`)
            .authenticate(appHelper.app)
            .send(send_data)
            .expect(422)
            .expect(expected);
        },
      );
    });

    describe("should update a musician", () => {
      const validRequests = [
        {
          send_data: {
            name: "Updated Name",
            stage_name: "Updated Stage Name",
          },
          expected: {
            name: "Updated Name",
            stage_name: "Updated Stage Name",
          },
        },
        {
          send_data: {
            email: "updated@example.com",
            bio: "Updated bio",
            phone: "+5511888888888",
            genres: ["Jazz", "Blues"],
            instruments: ["Piano", "Saxophone"],
            experience_years: 10,
            is_active: false,
          },
          expected: {
            email: "updated@example.com",
            bio: "Updated bio",
            phone: "+5511888888888",
            genres: ["Jazz", "Blues"],
            instruments: ["Piano", "Saxophone"],
            experience_years: 10,
            is_active: false,
          },
        },
      ];

      test.each(validRequests)(
        "when body is $send_data",
        async ({ send_data, expected }) => {
          const musician = Musician.create({
            email: "original@example.com",
            name: "Original Name",
            stage_name: "Original Stage",
            bio: "Original bio",
            phone: "+5511999999999",
            genres: ["Rock"],
            instruments: ["Guitar"],
            experience_years: 5,
            is_active: true,
          });
          await musicianRepo.insert(musician);

          const res = await request(appHelper.app.getHttpServer())
            .put(`/musicians/${musician.id.id}`)
            .authenticate(appHelper.app)
            .send(send_data)
            .expect(200);

          const keyInResponse = Object.keys(res.body);
          expect(keyInResponse).toStrictEqual(["data"]);

          const musicianUpdated = await musicianRepo.findById(musician.id);
          const presenter = MusicianController.serialize(
            MusicianOutputMapper.toOutput(musicianUpdated!),
          );
          const serialized = instanceToPlain(presenter);

          expect(res.body.data).toStrictEqual(serialized);

          // Verify specific updated fields
          Object.keys(expected).forEach((key) => {
            expect(res.body.data[key]).toStrictEqual(expected[key]);
          });
        },
      );
    });
  });
});
