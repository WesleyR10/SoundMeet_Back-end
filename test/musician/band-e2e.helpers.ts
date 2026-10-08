import { ExecutionContext } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { TestingModuleBuilder } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import request from "supertest";

import {
  AuthGuard,
  AuthUser,
  RolesGuard,
} from "../../src/nest-modules/auth-module";
import { ConfigModuleRoot } from "../../src/nest-modules/config-module/config-module.module";
import { PrismaService } from "../../src/nest-modules/database-module/prisma/prisma.service";
import { MusiciansModule } from "../../src/nest-modules/musicians-module/musicians.module";
import { musicianAuthUser } from "../../src/nest-modules/shared-module/testing/auth-guard-mock";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";
import { IdentityClaimsTestingModule } from "../../src/nest-modules/shared-module/testing/identity-claims-testing.module";

/**
 * Infra dos e2e de banda: o `MusiciansModule` de verdade, contra Postgres
 * REAL, com um `AuthGuard` de mentira que deixa o teste trocar de ator entre
 * uma requisição e outra.
 *
 * O ator precisa ser trocável porque o que estes testes exercitam é
 * justamente a diferença entre quem pede: líder × integrante × convidado ×
 * anônimo. O duplê fixo de `applyAuthGuardMocksAs` serve a quem tem um ator
 * só.
 *
 * ⚠️ O banco é o de desenvolvimento (`envs/.env.e2e`). Cada spec usa ids
 * próprios e apaga SÓ eles.
 */
export type BandE2EActor =
  | { kind: "musician"; id: string }
  | { kind: "admin"; id: string }
  /** Sem token. */
  | { kind: "anonymous" }
  /** Token que o `AuthGuard` recusou (expirado): só o `sub` não verificado. */
  | { kind: "rejected"; sub: string };

export function startBandE2EApp() {
  let actor: BandE2EActor = { kind: "anonymous" };

  const toAuthUser = (current: BandE2EActor): AuthUser | undefined => {
    if (current.kind === "musician") return musicianAuthUser(current.id);
    if (current.kind === "admin") {
      return {
        sub: current.id,
        roles: ["admin"],
        realm_access: { roles: ["admin"] },
      };
    }
    return undefined;
  };

  const configure = (builder: TestingModuleBuilder) =>
    builder
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          if (context.getType() !== "http") return true;
          const req = context.switchToHttp().getRequest();
          req.user = toAuthUser(actor);
          // É o que o guard real faz numa rota `@Public()` quando recusa o
          // token: segue como anônimo e anota de quem era.
          if (actor.kind === "rejected") req.rejectedTokenSub = actor.sub;
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true });

  const appHelper = startApp(
    {
      imports: [
        ConfigModuleRoot.forRoot(),
        EventEmitterModule.forRoot(),
        IdentityClaimsTestingModule,
        MusiciansModule,
      ],
    },
    configure,
  );

  const http = () => request(appHelper.app.getHttpServer());

  return {
    get app() {
      return appHelper.app;
    },
    prisma: () => appHelper.app.get(PrismaService),
    /** Define quem faz as próximas requisições. */
    as(next: BandE2EActor) {
      actor = next;
    },
    asMusician(id: string) {
      actor = { kind: "musician", id };
    },
    asAnonymous() {
      actor = { kind: "anonymous" };
    },
    get: (path: string) => http().get(`/api/v1${path}`),
    post: (path: string, body?: object) =>
      http()
        .post(`/api/v1${path}`)
        .send(body ?? {}),
    patch: (path: string, body?: object) =>
      http()
        .patch(`/api/v1${path}`)
        .send(body ?? {}),
    delete: (path: string) => http().delete(`/api/v1${path}`),
  };
}

/** Conexão própria para a limpeza do `afterAll` — o app já fechou. */
export async function withStandalonePrisma(
  run: (prisma: PrismaClient) => Promise<void>,
): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    await run(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

type Prisma = PrismaService | PrismaClient;

export async function seedMusician(
  prisma: Prisma,
  id: string,
  name: string,
): Promise<void> {
  await prisma.musician.create({
    data: {
      id,
      email: `e2e+${id}@soundmeet.local`,
      name,
      stage_name: name,
      genres: ["E2E"],
      instruments: ["Violão"],
      is_active: true,
    },
  });
}

export type SeedBandMember = {
  musician_id: string;
  role?: "leader" | "member";
  status?: "accepted" | "pending" | "declined";
  instrument?: string;
};

export async function seedBand(
  prisma: Prisma,
  band: {
    id: string;
    name: string;
    genres?: string[];
    open_to_gigs?: boolean | null;
    is_active?: boolean;
    price?: { min: number; max: number };
    address?: Record<string, unknown> & {
      latitude?: number;
      longitude?: number;
    };
    members: SeedBandMember[];
  },
): Promise<void> {
  await prisma.band.create({
    data: {
      id: band.id,
      name: band.name,
      genres: band.genres ?? ["E2E"],
      open_to_gigs: band.open_to_gigs ?? null,
      is_active: band.is_active ?? true,
      ...(band.price
        ? {
            price_model: "per_event",
            price_min: band.price.min,
            price_max: band.price.max,
            price_currency: "BRL",
          }
        : {}),
      ...(band.address
        ? {
            address: band.address as never,
            location_lat: band.address.latitude ?? null,
            location_lng: band.address.longitude ?? null,
          }
        : {}),
      members: {
        create: band.members.map((member) => ({
          musicianId: member.musician_id,
          role: member.role ?? "member",
          instrument: member.instrument ?? "Violão",
          status: member.status ?? "accepted",
          responded_at: member.status === "pending" ? null : new Date(),
        })),
      },
    },
  });
}

/**
 * Apaga tudo que os e2e de banda criam, na ordem que as FKs exigem: quem
 * aponta para a banda sai antes dela (as FKs são `SET NULL`, e `bookings`/
 * `inquiries` têm uma CHECK que o `SET NULL` viola).
 */
export async function purgeBandE2E(
  prisma: Prisma,
  ids: { bands: string[]; musicians: string[]; establishments?: string[] },
): Promise<void> {
  const bandId = { in: ids.bands };
  await prisma.booking.deleteMany({ where: { bandId } });
  await prisma.inquiry.deleteMany({ where: { bandId } });
  await prisma.eventMusician.deleteMany({ where: { bandId } });
  await prisma.band.deleteMany({ where: { id: bandId } });
  if (ids.establishments?.length) {
    await prisma.event.deleteMany({
      where: { establishmentId: { in: ids.establishments } },
    });
    await prisma.establishment.deleteMany({
      where: { id: { in: ids.establishments } },
    });
  }
  await prisma.subscription.deleteMany({
    where: { musician_id: { in: ids.musicians } },
  });
  await prisma.musician.deleteMany({ where: { id: { in: ids.musicians } } });
}
