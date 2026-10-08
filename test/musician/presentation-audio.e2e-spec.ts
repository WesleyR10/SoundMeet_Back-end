import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { EventEmitterModule } from "@nestjs/event-emitter";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import request from "supertest";

import { ConfigModuleRoot } from "../../src/nest-modules/config-module/config-module.module";
import { PrismaService } from "../../src/nest-modules/database-module/prisma/prisma.service";
import { MusiciansModule } from "../../src/nest-modules/musicians-module/musicians.module";
import {
  applyAuthGuardMocksAs,
  musicianAuthUser,
} from "../../src/nest-modules/shared-module/testing/auth-guard-mock";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";
import { IdentityClaimsTestingModule } from "../../src/nest-modules/shared-module/testing/identity-claims-testing.module";

/**
 * Áudio de apresentação — o caminho inteiro contra Postgres e MinIO REAIS.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O QUE SÓ ESTE TESTE COBRE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Os specs unitários provam as REGRAS (allowlist, 5–40s, ordem de escrita) com
 * o repositório in-memory e um storage de mentira. O que eles não conseguem
 * exercer é a FIAÇÃO — e é exatamente ali que este projeto já se queimou mais
 * de uma vez (o `MercadoPagoAccountNotLinkedError` virando 500 só apareceu
 * atravessando HTTP de verdade):
 *
 *  - o controller realmente chama `assertFileSignature` (bytes, não extensão);
 *  - a duração é medida de verdade por `music-metadata`, não recebida pronta;
 *  - o mapper Prisma guarda e relê as QUATRO colunas novas;
 *  - o multer estoura com `MulterError` e o filtro devolve **413**, não 500;
 *  - o objeto vai parar no bucket e a URL gravada aponta para ele.
 */

const E2E_MUSICIAN_ID = "6f2c1b9e-3a14-4d2b-9c77-5e8a41b7d903";

/** Gera um WAV PCM real — o mesmo formato que o seed sintetiza. */
function writeWav(filePath: string, seconds: number): void {
  const sampleRate = 22050;
  const totalSamples = Math.round(sampleRate * seconds);
  const dataBytes = totalSamples * 2;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataBytes, 40);

  const pcm = Buffer.alloc(dataBytes);
  for (let i = 0; i < totalSamples; i++) {
    const value = Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 0.4;
    pcm.writeInt16LE(Math.round(value * 32767), i * 2);
  }

  fs.writeFileSync(filePath, Buffer.concat([header, pcm]));
}

/**
 * Cliente do MESMO storage que o app vai usar.
 *
 * 🔴 Resolver por `ESTABLISHMENT_STORAGE_PROVIDER` não é preciosismo: neste
 * projeto o provider é **`cloudflare_r2` inclusive em dev**, então um helper
 * fixado em MinIO criaria um bucket local que ninguém usa enquanto os uploads
 * do teste iriam para o R2 — e a limpeza do `afterAll` varreria o lugar errado,
 * deixando ~15 MB de lixo no bucket real a cada execução.
 */
function buildS3(): { s3: S3Client; bucket: string; isMinio: boolean } {
  const provider = (
    process.env.ESTABLISHMENT_STORAGE_PROVIDER ?? "minio"
  ).trim();

  if (provider === "cloudflare_r2") {
    return {
      bucket: process.env.CLOUDFLARE_R2_BUCKET!,
      isMinio: false,
      s3: new S3Client({
        region: process.env.AWS_REGION ?? "auto",
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: true,
      }),
    };
  }

  const port = Number(process.env.MINIO_PORT ?? 9000);
  const endpoint = (process.env.MINIO_ENDPOINT ?? "localhost").trim();
  return {
    bucket: process.env.MINIO_BUCKET ?? "soundmeet-media",
    isMinio: true,
    s3: new S3Client({
      region: process.env.AWS_REGION ?? "us-east-1",
      endpoint: `http://${endpoint}:${port === 9001 ? 9000 : port}`,
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY ?? "soundmeet",
        secretAccessKey: process.env.MINIO_SECRET_KEY ?? "soundmeet123",
      },
      forcePathStyle: true,
    }),
  };
}

/** Apaga o que este teste subiu — só o prefixo do músico de e2e. */
async function purgeE2EObjects(): Promise<void> {
  const { s3, bucket } = buildS3();
  const prefix = `musicians/${E2E_MUSICIAN_ID}/`;

  try {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
    );
    const keys = (page.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => !!key);

    if (keys.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })) },
        }),
      );
    }
  } catch {
    // Limpeza é higiene, não asserção: falhar aqui mascararia o resultado real
    // do teste.
  }
}

describe("Áudio de apresentação do músico (e2e)", () => {
  jest.setTimeout(120_000);

  const appHelper = startApp(
    {
      imports: [
        ConfigModuleRoot.forRoot(),
        EventEmitterModule.forRoot(),
        IdentityClaimsTestingModule,
        MusiciansModule,
      ],
    },
    // Mesmo padrão do e2e de ai-audio: este teste exercita o pipeline de
    // upload, não a autenticação. Montar o AuthModule arrastaria Keycloak
    // para dentro de um cenário que não o testa.
    applyAuthGuardMocksAs(musicianAuthUser(E2E_MUSICIAN_ID)),
  );

  let tmpDir: string;

  beforeAll(async () => {
    const { s3, bucket, isMinio } = buildS3();
    if (isMinio) {
      try {
        await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      } catch {
        // Bucket já existe — o caso normal de quem já rodou o seed. No R2 o
        // bucket é criado pelo painel, e tentar criar aqui seria ruído.
      }
    }
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "presentation-audio-e2e-"));
  });

  afterAll(async () => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    // Sem isto, cada execução deixa ~15 MB de WAV no bucket REAL — que é o
    // mesmo que serve avatar e cardápio do app.
    await purgeE2EObjects();
  });

  beforeEach(async () => {
    const prisma = appHelper.app.get(PrismaService);
    await prisma.musician.upsert({
      where: { id: E2E_MUSICIAN_ID },
      update: {
        presentation_audio_url: null,
        presentation_audio_key: null,
        presentation_audio_duration_seconds: null,
        presentation_audio_uploaded_at: null,
      },
      create: {
        id: E2E_MUSICIAN_ID,
        email: `e2e+${E2E_MUSICIAN_ID}@soundmeet.local`,
        name: "E2E Presentation Audio",
      },
    });
  });

  it("sobe, persiste as quatro colunas e devolve o áudio no presenter", async () => {
    const file = path.join(tmpDir, "apresentacao.wav");
    writeWav(file, 32);

    const response = await request(appHelper.app.getHttpServer())
      .post(`/api/v1/musicians/${E2E_MUSICIAN_ID}/presentation-audio`)
      .attach("file", file, {
        filename: "apresentacao.wav",
        contentType: "audio/wav",
      })
      .expect(201);

    // A duração NÃO foi enviada pelo cliente: quem mediu foi o servidor.
    expect(response.body.data.presentation_audio).toMatchObject({
      duration_seconds: 32,
    });
    expect(response.body.data.presentation_audio.url).toMatch(/\.wav$/);
    // A object_key é detalhe interno de storage e não tem leitor fora daqui.
    expect(response.body.data.presentation_audio.object_key).toBeUndefined();

    const prisma = appHelper.app.get(PrismaService);
    const row = await prisma.musician.findUnique({
      where: { id: E2E_MUSICIAN_ID },
    });

    expect(row?.presentation_audio_url).toBe(
      response.body.data.presentation_audio.url,
    );
    // 🔴 A chave é o que permite apagar o objeto antigo na troca. URL sem chave
    // é o defeito que `avatar` tem e que este par existe para não repetir.
    expect(row?.presentation_audio_key).toMatch(
      new RegExp(`^musicians/${E2E_MUSICIAN_ID}/presentation-audio/.+\\.wav$`),
    );
    expect(row?.presentation_audio_duration_seconds).toBe(32);
    expect(row?.presentation_audio_uploaded_at).toBeInstanceOf(Date);
  });

  it("recusa áudio mais longo que 40s, dizendo a duração", async () => {
    const file = path.join(tmpDir, "longo.wav");
    writeWav(file, 72);

    const response = await request(appHelper.app.getHttpServer())
      .post(`/api/v1/musicians/${E2E_MUSICIAN_ID}/presentation-audio`)
      .attach("file", file, { filename: "longo.wav", contentType: "audio/wav" })
      .expect(422);

    expect(JSON.stringify(response.body.message)).toContain("1min12");
  });

  /*
   * O que o spec unitário de `detect-file-mime` não cobre: que o CONTROLLER
   * realmente chama a checagem. Um `content_type` mentido pelo cliente é o
   * caminho normal de quem tenta subir qualquer coisa.
   */
  it("recusa arquivo que não é áudio, mesmo anunciado como audio/wav", async () => {
    const file = path.join(tmpDir, "disfarcado.wav");
    fs.writeFileSync(file, Buffer.from("\x89PNG\r\n\x1a\n esta é uma imagem"));

    await request(appHelper.app.getHttpServer())
      .post(`/api/v1/musicians/${E2E_MUSICIAN_ID}/presentation-audio`)
      .attach("file", file, {
        filename: "disfarcado.wav",
        contentType: "audio/wav",
      })
      .expect(422);
  });

  /*
   * 🔴 O caso que virava 500 + alerta no Sentry antes do ramo de `MulterError`
   * no GlobalExceptionFilter: o músico lia "erro inesperado" sem descobrir que
   * bastava mandar um arquivo menor.
   */
  it("arquivo acima do limite responde 413, não 500", async () => {
    const file = path.join(tmpDir, "gigante.wav");
    // ~11 MB contra o teto de 10 MB.
    writeWav(file, 260);

    const response = await request(appHelper.app.getHttpServer())
      .post(`/api/v1/musicians/${E2E_MUSICIAN_ID}/presentation-audio`)
      .attach("file", file, {
        filename: "gigante.wav",
        contentType: "audio/wav",
      });

    expect(response.status).toBe(413);
    expect(JSON.stringify(response.body.message)).toContain("grande demais");
  });

  it("remover limpa as quatro colunas e é idempotente", async () => {
    const file = path.join(tmpDir, "para-remover.wav");
    writeWav(file, 20);

    await request(appHelper.app.getHttpServer())
      .post(`/api/v1/musicians/${E2E_MUSICIAN_ID}/presentation-audio`)
      .attach("file", file, {
        filename: "para-remover.wav",
        contentType: "audio/wav",
      })
      .expect(201);

    await request(appHelper.app.getHttpServer())
      .delete(`/api/v1/musicians/${E2E_MUSICIAN_ID}/presentation-audio`)
      .expect(200);

    const prisma = appHelper.app.get(PrismaService);
    const row = await prisma.musician.findUnique({
      where: { id: E2E_MUSICIAN_ID },
    });
    expect(row?.presentation_audio_url).toBeNull();
    expect(row?.presentation_audio_key).toBeNull();
    expect(row?.presentation_audio_duration_seconds).toBeNull();
    expect(row?.presentation_audio_uploaded_at).toBeNull();

    // Segunda remoção: 200 com o campo nulo, nunca erro — o único caminho até
    // aqui é apertar "remover", e quem já não tem áudio quer o estado que tem.
    const again = await request(appHelper.app.getHttpServer())
      .delete(`/api/v1/musicians/${E2E_MUSICIAN_ID}/presentation-audio`)
      .expect(200);
    expect(again.body.data.presentation_audio).toBeNull();
  });
});
