import request from "supertest";
import { IMusicianRepository } from "../../src/core/musician/domain/musician.repository";
import { MUSICIAN_PROVIDERS } from "../../src/nest-modules/musician-module/musician.providers";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";
import { Uuid } from "../../src/core/shared/domain/value-objects/uuid.vo";
import { MusicianController } from "../../src/nest-modules/musician-module/musician.controller";
import { MusicianOutputMapper } from "../../src/core/musician/application/use-cases/common/musician-output";
import { instanceToPlain } from "class-transformer";

describe("MusicianController (e2e)", () => {
  const appHelper = startApp();
  let musicianRepo: IMusicianRepository;

  beforeEach(async () => {
    musicianRepo = appHelper.app.get<IMusicianRepository>(
      MUSICIAN_PROVIDERS.REPOSITORIES.MUSICIAN_REPOSITORY.provide,
    );
  });

  describe("/musicians (POST)", () => {
    describe("unauthenticated", () => {
      const app = startApp();

      test("should return 401 when not authenticated", () => {
        return request(app.app.getHttpServer())
          .post("/musicians")
          .send({})
          .expect(401);
      });

      test("should return 403 when not authenticated as admin", () => {
        return request(app.app.getHttpServer())
          .post("/musicians")
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
              "genres must be an array",
              "instruments must be an array",
            ],
            error: "Bad Request",
            statusCode: 422,
          },
        },
        {
          label: "invalid email",
          send_data: {
            email: "invalid-email",
            name: "Test Musician",
            genres: ["Rock"],
            instruments: ["Guitar"],
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
            email: "test@example.com",
            name: "",
            genres: ["Rock"],
            instruments: ["Guitar"],
          },
          expected: {
            message: ["name should not be empty"],
            error: "Bad Request",
            statusCode: 422,
          },
        },
      ];

      test.each(invalidRequests)(
        "when body is $label",
        ({ send_data, expected }) => {
          return request(appHelper.app.getHttpServer())
            .post("/musicians")
            .authenticate(appHelper.app)
            .send(send_data)
            .expect(422)
            .expect(expected);
        },
      );
    });

    describe("should create a musician", () => {
      const validRequests = [
        {
          send_data: {
            email: "musician@example.com",
            name: "John Doe",
            genres: ["Rock", "Blues"],
            instruments: ["Guitar", "Vocals"],
          },
          expected: {
            email: "musician@example.com",
            name: "John Doe",
            stage_name: null,
            bio: null,
            avatar: null,
            phone: null,
            genres: ["Rock", "Blues"],
            instruments: ["Guitar", "Vocals"],
            experience_years: 0,
            rating: 0,
            total_ratings: 0,
            is_active: true,
            is_verified: false,
          },
        },
        {
          send_data: {
            email: "band@example.com",
            name: "The Rock Band",
            stage_name: "Rock Stars",
            bio: "A great rock band",
            phone: "+5511999999999",
            genres: ["Rock", "Metal"],
            instruments: ["Guitar", "Bass", "Drums"],
            experience_years: 5,
            is_active: true,
          },
          expected: {
            email: "band@example.com",
            name: "The Rock Band",
            stage_name: "Rock Stars",
            bio: "A great rock band",
            avatar: null,
            phone: "+5511999999999",
            genres: ["Rock", "Metal"],
            instruments: ["Guitar", "Bass", "Drums"],
            experience_years: 5,
            rating: 0,
            total_ratings: 0,
            is_active: true,
            is_verified: false,
          },
        },
      ];

      test.each(validRequests)(
        "when body is $send_data",
        async ({ send_data, expected }) => {
          const res = await request(appHelper.app.getHttpServer())
            .post("/musicians")
            .authenticate(appHelper.app)
            .send(send_data)
            .expect(201);

          const keyInResponse = Object.keys(res.body);
          expect(keyInResponse).toStrictEqual(["data"]);

          const musicianCreated = await musicianRepo.findById(
            new Uuid(res.body.data.id),
          );
          const presenter = MusicianController.serialize(
            MusicianOutputMapper.toOutput(musicianCreated!),
          );
          const serialized = instanceToPlain(presenter);

          expect(res.body.data).toStrictEqual({
            id: serialized.id,
            created_at: serialized.created_at,
            ...expected,
          });
        },
      );
    });
  });
});
