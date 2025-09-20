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

  describe("/musicians/:id (GET)", () => {
    describe("unauthenticated", () => {
      const app = startApp();

      test("should return 401 when not authenticated", () => {
        const musicianId = new Uuid();
        return request(app.app.getHttpServer())
          .get(`/musicians/${musicianId.id}`)
          .expect(401);
      });

      test("should return 403 when not authenticated as admin", () => {
        const musicianId = new Uuid();
        return request(app.app.getHttpServer())
          .get(`/musicians/${musicianId.id}`)
          .authenticate(app.app, false)
          .expect(403);
      });
    });

    test("should return a response error with 422 status code when id is not valid", () => {
      return request(appHelper.app.getHttpServer())
        .get("/musicians/fake-id")
        .authenticate(appHelper.app)
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
        .get(`/musicians/${musicianId.id}`)
        .authenticate(appHelper.app)
        .expect(404)
        .expect({
          message: `Musician not found using ID ${musicianId.id}`,
          error: "Not Found",
          statusCode: 404,
        });
    });

    test("should return a musician", async () => {
      const musician = Musician.create({
        email: "test@example.com",
        name: "Test Musician",
        stage_name: "Test Stage",
        bio: "Test bio",
        phone: "+5511999999999",
        genres: ["Rock", "Blues"],
        instruments: ["Guitar", "Vocals"],
        experience_years: 5,
        is_active: true,
      });
      await musicianRepo.insert(musician);

      const res = await request(appHelper.app.getHttpServer())
        .get(`/musicians/${musician.id.id}`)
        .authenticate(appHelper.app)
        .expect(200);

      const keyInResponse = Object.keys(res.body);
      expect(keyInResponse).toStrictEqual(["data"]);

      const presenter = MusicianController.serialize(
        MusicianOutputMapper.toOutput(musician),
      );
      const serialized = instanceToPlain(presenter);
      expect(res.body.data).toStrictEqual(serialized);
    });
  });
});
