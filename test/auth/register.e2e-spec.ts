import request from "supertest";

import { IIdentityProviderGateway } from "../../src/core/auth/infra/gateways/identity-provider-gateway.interface";
import { AuthModule } from "../../src/nest-modules/auth-module/auth.module";
import { ConfigModuleRoot } from "../../src/nest-modules/config-module/config-module.module";
import { PrismaService } from "../../src/nest-modules/database-module/prisma/prisma.service";
import { MailModule } from "../../src/nest-modules/mail-module/mail.module";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";

function decodeJwt(token: string): Record<string, any> {
  const payload = token.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
}

describe("Auth Register (e2e)", () => {
  jest.setTimeout(30_000);

  const appHelper = startApp({
    imports: [ConfigModuleRoot.forRoot(), AuthModule, MailModule],
  });

  const runId = Date.now();

  // startApp() recria o app (e fecha PrismaService) a cada teste — por isso a
  // limpeza acontece dentro de cada it(), enquanto o app daquele teste ainda
  // está de pé, em vez de um afterAll compartilhado no fim da suíte.
  async function cleanupProfile(profileId: string): Promise<void> {
    const identityGateway = appHelper.app.get<IIdentityProviderGateway>(
      "IdentityProviderGateway",
    );
    try {
      await identityGateway.deleteUser(profileId);
    } catch {
      // best-effort — não falha o teste por não conseguir limpar
    }

    const prisma = appHelper.app.get(PrismaService);
    await prisma.musician.deleteMany({ where: { id: profileId } });
    await prisma.audience.deleteMany({ where: { id: profileId } });
  }

  it("registra um músico, retorna tokens e o profile_id bate com o sub do JWT", async () => {
    const email = `e2e-musico-${runId}@soundmeet.local`;

    const res = await request(appHelper.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ name: "E2E Músico", email, password: "Senha123", role: "musician" })
      .expect(201);

    const output = res.body.data;
    expect(output.role).toBe("musician");
    expect(output.access_token).toBeDefined();
    expect(output.refresh_token).toBeDefined();

    const decoded = decodeJwt(output.access_token);
    expect(decoded.sub).toBe(output.profile_id);
    expect(decoded.realm_access.roles).toContain("musician");

    const prisma = appHelper.app.get(PrismaService);
    const musician = await prisma.musician.findUnique({
      where: { id: output.profile_id },
    });
    expect(musician).not.toBeNull();
    expect(musician!.email).toBe(email);

    await cleanupProfile(output.profile_id);
  });

  it("registra um público (audience), retorna tokens e o profile_id bate com o sub do JWT", async () => {
    const email = `e2e-fa-${runId}@soundmeet.local`;

    const res = await request(appHelper.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ name: "E2E Fã", email, password: "Senha123", role: "audience" })
      .expect(201);

    const output = res.body.data;
    expect(output.role).toBe("audience");

    const decoded = decodeJwt(output.access_token);
    expect(decoded.sub).toBe(output.profile_id);
    expect(decoded.realm_access.roles).toContain("audience");

    const prisma = appHelper.app.get(PrismaService);
    const audience = await prisma.audience.findUnique({
      where: { id: output.profile_id },
    });
    expect(audience).not.toBeNull();
    expect(audience!.email).toBe(email);

    await cleanupProfile(output.profile_id);
  });

  it("rejeita email já cadastrado com 409", async () => {
    const email = `e2e-duplicado-${runId}@soundmeet.local`;

    const first = await request(appHelper.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ name: "Primeiro", email, password: "Senha123", role: "musician" })
      .expect(201);

    const res = await request(appHelper.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ name: "Segundo", email, password: "Senha123", role: "musician" })
      .expect(409);

    expect(res.body.message).toEqual(["Email já cadastrado"]);

    await cleanupProfile(first.body.data.profile_id);
  });

  it("rejeita senha fraca com 422", async () => {
    const email = `e2e-senha-fraca-${runId}@soundmeet.local`;

    const res = await request(appHelper.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ name: "Senha Fraca", email, password: "123", role: "musician" })
      .expect(422);

    expect(res.body.message.join(" ")).toEqual(
      expect.stringContaining("maiúscula"),
    );
  });

  it("rejeita role inválida com 422", async () => {
    const email = `e2e-role-invalida-${runId}@soundmeet.local`;

    await request(appHelper.app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ name: "Role Inválida", email, password: "Senha123", role: "admin" })
      .expect(422);
  });
});
