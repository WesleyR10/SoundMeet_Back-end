import { Controller, Get, INestApplication, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { Public, Roles } from "../auth.decorators";
import { AuthGuard } from "../auth.guard";
import { AuthJwtVerifier } from "../auth-jwt.verifier";
import { RolesGuard } from "../roles.guard";

@Controller("auth-http-stub")
@UseGuards(AuthGuard, RolesGuard)
class AuthHttpStubController {
  @Get("public")
  @Public()
  publicRoute() {
    return { ok: true };
  }

  @Get("musician")
  @Roles("musician")
  musicianRoute() {
    return { ok: true };
  }
}

describe("Auth HTTP integration", () => {
  let app: INestApplication;
  const verifier = {
    verify: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthHttpStubController],
      providers: [
        AuthGuard,
        RolesGuard,
        {
          provide: AuthJwtVerifier,
          useValue: verifier,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("allows public routes without bearer token", async () => {
    await request(app.getHttpServer())
      .get("/auth-http-stub/public")
      .expect(200)
      .expect({ ok: true });
  });

  it("rejects protected routes without bearer token", async () => {
    await request(app.getHttpServer())
      .get("/auth-http-stub/musician")
      .expect(401);
  });

  it("rejects authenticated users without required role", async () => {
    verifier.verify.mockResolvedValue({ sub: "user-id", roles: ["audience"] });

    await request(app.getHttpServer())
      .get("/auth-http-stub/musician")
      .set("Authorization", "Bearer valid-token")
      .expect(403);
  });

  it("allows authenticated users with required role", async () => {
    verifier.verify.mockResolvedValue({ sub: "user-id", roles: ["musician"] });

    await request(app.getHttpServer())
      .get("/auth-http-stub/musician")
      .set("Authorization", "Bearer valid-token")
      .expect(200)
      .expect({ ok: true });
  });
});
