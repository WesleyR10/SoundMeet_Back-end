import request from "supertest";
import { IMusicianRepository } from "../../src/core/musician/domain/musician.repository";
import { MUSICIAN_PROVIDERS } from "../../src/nest-modules/musician-module/musician.providers";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";
import { Uuid } from "../../src/core/shared/domain/value-objects/uuid.vo";
import { Musician } from "../../src/core/musician/domain/musician.aggregate";
import { NotFoundError } from "../../src/core/shared/domain/errors/not-found.error";

describe("MusicianController (e2e)", () => {
  const appHelper = startApp();
  let musicianRepo: IMusicianRepository;

  beforeEach(async () => {
    musicianRepo = appHelper.app.get<IMusicianRepository>(
      MUSICIAN_PROVIDERS.REPOSITORIES.MUSICIAN_REPOSITORY.provide,
    );
  });

  describe("/musicians/:id (DELETE)", () => {
    describe("unauthenticated", () => {
      const app = startApp();

      test("should return 401 when not authenticated", () => {
        const musicianId = new Uuid();
        return request(app.app.getHttpServer())
          .delete(`/musicians/${musicianId.id}`)
          .expect(401);
      });

      test("should return 403 when not authenticated as admin", () => {
        const musicianId = new Uuid();
        return request(app.app.getHttpServer())
          .delete(`/musicians/${musicianId.id}`)
          .authenticate(app.app, false)
          .expect(403);
      });
    });

    test("should return a response error with 422 status code when id is not valid", () => {
      return request(appHelper.app.getHttpServer())
        .delete("/musicians/fake-id")
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
        .delete(`/musicians/${musicianId.id}`)
        .authenticate(appHelper.app)
        .expect(404)
        .expect({
          message: `Musician not found using ID ${musicianId.id}`,
          error: "Not Found",
          statusCode: 404,
        });
    });

    test("should delete a musician", async () => {
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

      await request(appHelper.app.getHttpServer())
        .delete(`/musicians/${musician.id.id}`)
        .authenticate(appHelper.app)
        .expect(204);

      // Verify musician was deleted
      await expect(musicianRepo.findById(musician.id)).rejects.toThrow(
        new NotFoundError(musician.id.id, Musician),
      );
    });

    test("should delete multiple musicians", async () => {
      const musicians = [
        Musician.create({
          email: "musician1@example.com",
          name: "Musician 1",
          genres: ["Rock"],
          instruments: ["Guitar"],
        }),
        Musician.create({
          email: "musician2@example.com",
          name: "Musician 2",
          genres: ["Jazz"],
          instruments: ["Piano"],
        }),
        Musician.create({
          email: "musician3@example.com",
          name: "Musician 3",
          genres: ["Blues"],
          instruments: ["Harmonica"],
        }),
      ];

      await musicianRepo.bulkInsert(musicians);

      // Delete first musician
      await request(appHelper.app.getHttpServer())
        .delete(`/musicians/${musicians[0].id.id}`)
        .authenticate(appHelper.app)
        .expect(204);

      // Delete second musician
      await request(appHelper.app.getHttpServer())
        .delete(`/musicians/${musicians[1].id.id}`)
        .authenticate(appHelper.app)
        .expect(204);

      // Verify first two musicians were deleted
      await expect(musicianRepo.findById(musicians[0].id)).rejects.toThrow(
        NotFoundError,
      );

      await expect(musicianRepo.findById(musicians[1].id)).rejects.toThrow(
        NotFoundError,
      );

      // Verify third musician still exists
      const remainingMusician = await musicianRepo.findById(musicians[2].id);
      expect(remainingMusician).toBeDefined();
      expect(remainingMusician!.name).toBe("Musician 3");
    });
  });
});
