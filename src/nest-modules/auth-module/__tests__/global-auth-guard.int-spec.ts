import { Controller, Get, INestApplication, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { Public } from "../auth.decorators";
import { AuthGuard } from "../auth.guard";
import { AuthJwtVerifier } from "../auth-jwt.verifier";
import { InternalToken } from "../internal-token.decorator";
import { InternalTokenGuard } from "../internal-token.guard";

/**
 * 🔴 AUTH-2 — prova de RUNTIME da composição de guards.
 *
 * `route-auth-coverage.spec.ts` prova que a metadata está certa (quem é
 * `@Public()`); este arquivo prova o que acontece quando as requisições chegam.
 * São perguntas diferentes, e a segunda é a que quebraria a pipeline de IA em
 * produção sem nenhum erro de compilação:
 *
 * O `AuthGuard` global roda ANTES dos guards de controller. As rotas
 * `internal/` dos workers de IA são autenticadas por `x-ai-*-token`, não por
 * JWT — o worker Python não tem sessão de ninguém. Sem `@Public()` nelas, o
 * guard global passaria a exigir um Bearer que nunca existiu e a análise de
 * cifra pararia de concluir, com 401 no lugar do progresso.
 *
 * O par de asserções que importa: `@Public()` faz o AuthGuard liberar, **e o
 * InternalTokenGuard continua barrando** quem não tem o token. Se alguém um dia
 * "simplificar" removendo um dos dois, um destes casos fica vermelho.
 */

const INTERNAL_HEADER = "x-test-internal-token";
const INTERNAL_ENV_KEY = "AI_CIFRA_PROGRESS_TOKEN";
const VALID_TOKEN = "token-interno-de-teste";

@Controller("guard-fixture")
class GuardFixtureController {
  // Rota comum: sem `@Public()`, o guard global exige JWT.
  @Get("protegida")
  protegida() {
    return { ok: true };
  }

  // Rota pública de catálogo: soft-auth, sem exigir token.
  @Get("publica")
  @Public()
  publica() {
    return { ok: true };
  }

  // O formato das rotas `internal/` de ai-cifra e ai-audio.
  @Get("worker")
  @Public()
  @UseGuards(InternalTokenGuard)
  @InternalToken({
    envKey: INTERNAL_ENV_KEY,
    headerName: INTERNAL_HEADER,
  })
  worker() {
    return { ok: true };
  }
}

describe("AuthGuard global + InternalTokenGuard (AUTH-2)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GuardFixtureController],
      providers: [
        Reflector,
        InternalTokenGuard,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === INTERNAL_ENV_KEY ? VALID_TOKEN : undefined,
          },
        },
        {
          // Verificador de JWT falso: aceita só o literal "token-bom".
          provide: AuthJwtVerifier,
          useValue: {
            verify: jest.fn(async (token: string) => {
              if (token !== "token-bom") throw new Error("invalid");
              return { sub: "user-1", realm_access: { roles: ["musician"] } };
            }),
          },
        },
        // É isto que o `app.module.ts` faz em produção.
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe("rota sem @Public()", () => {
    it("401 sem Authorization — o default virou fechado", async () => {
      await request(app.getHttpServer())
        .get("/guard-fixture/protegida")
        .expect(401);
    });

    it("401 com token inválido", async () => {
      await request(app.getHttpServer())
        .get("/guard-fixture/protegida")
        .set("Authorization", "Bearer token-ruim")
        .expect(401);
    });

    it("200 com token válido", async () => {
      await request(app.getHttpServer())
        .get("/guard-fixture/protegida")
        .set("Authorization", "Bearer token-bom")
        .expect(200);
    });
  });

  describe("rota @Public()", () => {
    it("200 sem token nenhum", async () => {
      await request(app.getHttpServer())
        .get("/guard-fixture/publica")
        .expect(200);
    });

    it("200 com Bearer inválido — degrada para anônimo, nunca 401", async () => {
      // O app manda o JWT em toda chamada, inclusive nas públicas. Um token
      // velho numa rota pública não pode virar erro: quebraria o funil do QR.
      await request(app.getHttpServer())
        .get("/guard-fixture/publica")
        .set("Authorization", "Bearer token-ruim")
        .expect(200);
    });
  });

  describe("rota de worker: @Public() + InternalTokenGuard", () => {
    it("🔴 200 SEM JWT, com o token interno correto — o caminho do worker", async () => {
      await request(app.getHttpServer())
        .get("/guard-fixture/worker")
        .set(INTERNAL_HEADER, VALID_TOKEN)
        .expect(200);
    });

    it("🔴 403 sem o token interno — @Public() não abriu a rota", async () => {
      // Este é o par do caso acima. `@Public()` ali significa "sem JWT de
      // usuário", nunca "aberta": quem autentica continua sendo o header.
      await request(app.getHttpServer())
        .get("/guard-fixture/worker")
        .expect(403);
    });

    it("403 com token interno errado", async () => {
      await request(app.getHttpServer())
        .get("/guard-fixture/worker")
        .set(INTERNAL_HEADER, "token-errado")
        .expect(403);
    });

    it("403 com token interno de prefixo correto mas truncado", async () => {
      // Regressão da comparação constant-time: `timingSafeEqual` exige mesmo
      // tamanho, então a checagem de comprimento precisa vir antes e recusar.
      await request(app.getHttpServer())
        .get("/guard-fixture/worker")
        .set(INTERNAL_HEADER, VALID_TOKEN.slice(0, 5))
        .expect(403);
    });
  });
});
