import request from "supertest";
import { IMusicianRepository } from "../../src/core/musician/domain/musician.repository";
import { MUSICIAN_PROVIDERS } from "../../src/nest-modules/musician-module/musician.providers";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";
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

  describe("/musicians (GET)", () => {
    describe("unauthenticated", () => {
      const app = startApp();

      test("should return 401 when not authenticated", () => {
        return request(app.app.getHttpServer()).get("/musicians").expect(401);
      });

      test("should return 403 when not authenticated as admin", () => {
        return request(app.app.getHttpServer())
          .get("/musicians")
          .authenticate(app.app, false)
          .expect(403);
      });
    });

    describe("should return musicians ordered by created_at when request query is empty", () => {
      test("should return empty list when no musicians exist", async () => {
        const res = await request(appHelper.app.getHttpServer())
          .get("/musicians")
          .authenticate(appHelper.app)
          .expect(200);

        expect(res.body).toStrictEqual({
          data: [],
          meta: {
            current_page: 1,
            last_page: 0,
            per_page: 15,
            total: 0,
          },
        });
      });

      test("should return musicians list", async () => {
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
        ];

        await musicianRepo.bulkInsert(musicians);

        const res = await request(appHelper.app.getHttpServer())
          .get("/musicians")
          .authenticate(appHelper.app)
          .expect(200);

        const keyInResponse = Object.keys(res.body);
        expect(keyInResponse).toStrictEqual(["data", "meta"]);

        const presenter = new MusicianController().search({
          page: 1,
          per_page: 15,
          sort: "created_at",
          sort_dir: "desc",
          filter: null,
        });

        expect(res.body.meta).toStrictEqual({
          current_page: 1,
          last_page: 1,
          per_page: 15,
          total: 2,
        });

        expect(res.body.data).toHaveLength(2);
        expect(res.body.data[0].name).toBe("Musician 2");
        expect(res.body.data[1].name).toBe("Musician 1");
      });
    });

    describe("should return musicians using pagination, filter and sort", () => {
      const musicians = [
        Musician.create({
          email: "john@example.com",
          name: "John Doe",
          stage_name: "Johnny Rock",
          genres: ["Rock"],
          instruments: ["Guitar"],
        }),
        Musician.create({
          email: "jane@example.com",
          name: "Jane Smith",
          stage_name: "Jazz Jane",
          genres: ["Jazz"],
          instruments: ["Piano"],
        }),
        Musician.create({
          email: "bob@example.com",
          name: "Bob Wilson",
          genres: ["Blues"],
          instruments: ["Harmonica"],
        }),
      ];

      beforeEach(async () => {
        await musicianRepo.bulkInsert(musicians);
      });

      test("should return musicians filtered by name", async () => {
        const res = await request(appHelper.app.getHttpServer())
          .get("/musicians")
          .query({ filter: "John" })
          .authenticate(appHelper.app)
          .expect(200);

        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].name).toBe("John Doe");
        expect(res.body.meta.total).toBe(1);
      });

      test("should return musicians with pagination", async () => {
        const res = await request(appHelper.app.getHttpServer())
          .get("/musicians")
          .query({ page: 1, per_page: 2 })
          .authenticate(appHelper.app)
          .expect(200);

        expect(res.body.data).toHaveLength(2);
        expect(res.body.meta).toStrictEqual({
          current_page: 1,
          last_page: 2,
          per_page: 2,
          total: 3,
        });
      });

      test("should return musicians sorted by name", async () => {
        const res = await request(appHelper.app.getHttpServer())
          .get("/musicians")
          .query({ sort: "name", sort_dir: "asc" })
          .authenticate(appHelper.app)
          .expect(200);

        expect(res.body.data).toHaveLength(3);
        expect(res.body.data[0].name).toBe("Bob Wilson");
        expect(res.body.data[1].name).toBe("Jane Smith");
        expect(res.body.data[2].name).toBe("John Doe");
      });
    });
  });
});
