import {
  CreateBucketCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import request from "supertest";
import { promisify } from "util";

import { DomainError } from "../../src/core/shared/domain/errors/domain.error";
import { AiCifraModule } from "../../src/nest-modules/ai-cifra-module/ai-cifra.module";
import { ConfigModuleRoot } from "../../src/nest-modules/config-module/config-module.module";
import { PrismaService } from "../../src/nest-modules/database-module/prisma/prisma.service";
import {
  applyAuthGuardMocksAs,
  musicianAuthUser,
} from "../../src/nest-modules/shared-module/testing/auth-guard-mock";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";

// Mesmo id usado no corpo do teste: o duplê do AuthGuard autentica
// exatamente este músico, então a rota enxerga o dono do recurso.
const E2E_MUSICIAN_ID = "3d2f7f8a-20f4-4d6a-9dbe-f5a76c0bfe61";

const SAMPLE_DIR = path.resolve(process.cwd(), "sample");
const DEFAULT_AUDIO_FILE_NAME = "Nós Dois - Lourena.mp3";

const execFileAsync = promisify(execFile);

async function safeDockerComposeUpAiCifraWorker(): Promise<void> {
  try {
    await execFileAsync("docker", ["compose", "up", "-d", "ai-cifra-worker"], {
      cwd: process.cwd(),
      timeout: 5 * 60 * 1000,
    });
  } catch (error: any) {
    const msg = String(error?.message ?? error);
    if (msg.includes("container name") && msg.includes("already in use")) {
      await execFileAsync("docker", ["rm", "-f", "soundmeet-ai-cifra-worker"], {
        cwd: process.cwd(),
        timeout: 60 * 1000,
      });
      await execFileAsync(
        "docker",
        ["compose", "up", "-d", "ai-cifra-worker"],
        {
          cwd: process.cwd(),
          timeout: 5 * 60 * 1000,
        },
      );
      return;
    }
    throw error;
  }
}

function buildS3ClientFromEnv(): { s3: S3Client; bucket: string } {
  const provider = (process.env.AI_CIFRA_STORAGE_PROVIDER ?? "minio").trim();
  const region = process.env.AWS_REGION ?? "us-east-1";

  if (provider === "cloudflare_r2") {
    const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT!;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
    const bucket = process.env.CLOUDFLARE_R2_BUCKET!;
    const s3 = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
    return { s3, bucket };
  }

  const port = Number(process.env.MINIO_PORT ?? 9000);
  const s3Port = port === 9001 ? 9000 : port;
  const minioEndpoint = (process.env.MINIO_ENDPOINT ?? "localhost").trim();
  const accessKeyId = process.env.MINIO_ACCESS_KEY ?? "soundmeet";
  const secretAccessKey = process.env.MINIO_SECRET_KEY ?? "soundmeet123";
  const bucket = process.env.MINIO_BUCKET ?? "soundmeet-media";

  const s3 = new S3Client({
    region,
    endpoint: `http://${minioEndpoint}:${s3Port}`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return { s3, bucket };
}

async function ensureBucketExists(s3: S3Client, bucket: string) {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error: any) {
    // aws-sdk v3 expõe o código do erro em `name` (v2 usava `code`)
    const code = `${error?.name ?? error?.code ?? ""}`;
    if (
      code !== "BucketAlreadyOwnedByYou" &&
      code !== "BucketAlreadyExists" &&
      code !== "InvalidBucketState"
    ) {
      throw error;
    }
  }
}

function guessContentTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".wav") return "audio/wav";
  if (ext === ".flac") return "audio/flac";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".m4a" || ext === ".mp4") return "audio/mp4";
  return "audio/mpeg";
}

/**
 * Resolve o arquivo pelo nome dentro de `sample/`, comparando em forma Unicode
 * normalizada.
 *
 * Necessário porque acentos têm duas representações equivalentes em UTF-8:
 * NFC (`ó` = U+00F3) e NFD (`o` + U+0301). O nome gravado no disco e o literal
 * deste arquivo podem estar em formas diferentes — visualmente idênticos, mas
 * com bytes distintos — e aí `fs.existsSync` falha com o arquivo presente.
 */
function resolveSampleByName(fileName: string): string | null {
  const direct = path.join(SAMPLE_DIR, fileName);
  if (fs.existsSync(direct)) return direct;

  if (!fs.existsSync(SAMPLE_DIR)) return null;
  const target = fileName.normalize("NFC");
  const match = fs
    .readdirSync(SAMPLE_DIR)
    .find((entry) => entry.normalize("NFC") === target);
  return match ? path.join(SAMPLE_DIR, match) : null;
}

function resolveAudioFile(): { filePath: string; contentType: string } {
  const envFile = (process.env.AI_CIFRA_E2E_FILE ?? "").trim();
  const filePath = envFile || resolveSampleByName(DEFAULT_AUDIO_FILE_NAME);
  if (!filePath || !fs.existsSync(filePath)) {
    const attempted = envFile || path.join(SAMPLE_DIR, DEFAULT_AUDIO_FILE_NAME);
    throw new DomainError(`Arquivo de áudio não encontrado: ${attempted}`);
  }
  return { filePath, contentType: guessContentTypeFromPath(filePath) };
}

function getAnalysisEndpointFromEnv(): { baseURL: string; reqPath: string } {
  const baseURL = (process.env.AI_CIFRA_ANALYSIS_HTTP_BASE_URL ?? "").trim();
  const reqPath = (process.env.AI_CIFRA_ANALYSIS_HTTP_PATH ?? "").trim();
  if (!baseURL || !reqPath) {
    throw new DomainError(
      "AI_CIFRA_ANALYSIS_HTTP_BASE_URL/AI_CIFRA_ANALYSIS_HTTP_PATH não configurados",
    );
  }
  return { baseURL, reqPath };
}

async function isAnalysisServiceReachable(): Promise<boolean> {
  const { baseURL, reqPath } = getAnalysisEndpointFromEnv();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const health = await fetch(`${baseURL}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    if (health.status >= 200 && health.status < 500) {
      return true;
    }

    const res = await fetch(`${baseURL}${reqPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

let startedDockerWorker = false;

async function startDockerWorkerIfNeeded(): Promise<void> {
  if (startedDockerWorker) return;
  await safeDockerComposeUpAiCifraWorker();
  startedDockerWorker = true;
}

async function stopDockerWorkerIfStarted(): Promise<void> {
  if (!startedDockerWorker) return;
  startedDockerWorker = false;
  try {
    await execFileAsync("docker", ["compose", "stop", "ai-cifra-worker"], {
      cwd: process.cwd(),
      timeout: 60 * 1000,
    });
  } catch {
    return;
  }
}

async function ensureAnalysisServiceReachable(): Promise<void> {
  const { baseURL, reqPath } = getAnalysisEndpointFromEnv();
  if (await isAnalysisServiceReachable()) return;

  try {
    await startDockerWorkerIfNeeded();
  } catch (error: any) {
    throw new DomainError(
      `Não foi possível iniciar o worker Python (ai-cifra-mir-worker) via Docker Compose. ` +
        `Serviço de análise de cifra indisponível em ${baseURL}${reqPath}. ` +
        `Erro: ${String(error?.message ?? error)}`,
    );
  }

  const startAt = Date.now();
  const timeoutMs = Number(
    process.env.AI_CIFRA_E2E_WORKER_START_TIMEOUT_MS ?? 120_000,
  );
  for (;;) {
    if (await isAnalysisServiceReachable()) return;
    if (Date.now() - startAt > timeoutMs) {
      throw new DomainError(
        `Timeout ao iniciar worker. Serviço de análise de cifra indisponível em ${baseURL}${reqPath}.`,
      );
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

describe("AI Cifra (e2e)", () => {
  jest.setTimeout(60 * 60 * 1000);

  const appHelper = startApp(
    {
      imports: [ConfigModuleRoot.forRoot(), AiCifraModule],
    },
    // As rotas são @UseGuards(AuthGuard, RolesGuard) e este e2e exercita o
    // pipeline de áudio, não a autenticação — mockar os guards é o mesmo
    // padrão dos .int-spec.ts dos controllers. Sem isso o teste tomaria 401,
    // e montar AuthModule só para instanciar o AuthJwtVerifier arrastaria
    // Keycloak/e-mail para dentro de um cenário que não os testa.
    applyAuthGuardMocksAs(musicianAuthUser(E2E_MUSICIAN_ID)),
  );

  beforeAll(async () => {
    await ensureAnalysisServiceReachable();

    const { s3, bucket } = buildS3ClientFromEnv();
    await ensureBucketExists(s3, bucket);
  });

  afterAll(async () => {
    await stopDockerWorkerIfStarted();
  });

  it("cria upload e processa análise de cifra", async () => {
    const musician_id = E2E_MUSICIAN_ID;
    const { filePath: audioFilePath, contentType } = resolveAudioFile();

    const { s3, bucket } = buildS3ClientFromEnv();
    const audioStat = fs.statSync(audioFilePath);
    console.log(
      `[e2e] ai-cifra file=${path.basename(audioFilePath)} bytes=${audioStat.size} content_type=${contentType}`,
    );

    const prisma = appHelper.app.get(PrismaService);
    await prisma.musician.upsert({
      where: { id: musician_id },
      update: {},
      create: {
        id: musician_id,
        email: `e2e+${musician_id}@soundmeet.local`,
        name: "E2E Musician",
      },
    });

    const uploadRes = await request(appHelper.app.getHttpServer())
      .post(`/api/v1/musicians/${musician_id}/ai-cifra/uploads`)
      .attach("file", audioFilePath, {
        filename: path.basename(audioFilePath),
        contentType,
      })
      .expect(201);

    const upload = uploadRes.body.data;

    const stored = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: upload.object_key }),
    );
    expect(Number(stored.ContentLength)).toBe(audioStat.size);

    const analysisRes = await request(appHelper.app.getHttpServer())
      .post(`/api/v1/ai-cifra/uploads/${upload.id}/analyses`)
      // Sem model_id de propósito: usa o AI_CIFRA_DEFAULT_MODEL_ID do
      // ambiente. Fixar um id aqui faz o teste apodrecer a cada troca de
      // modelo — foi o que aconteceu com "crema_v1", que saiu da allowlist
      // (DEFAULT_ALLOWED_MODEL_IDS em ai-cifra.providers.ts) e passou a dar 422.
      .send({})
      .expect(201);

    const job = analysisRes.body.data;

    const startAt = Date.now();

    let finalJob: any;
    const analysisTimeoutMs = Number(
      process.env.AI_CIFRA_E2E_TIMEOUT_MS ?? 60 * 60 * 1000,
    );
    for (let attempt = 0; attempt < 10_000; attempt++) {
      const jobRes = await request(appHelper.app.getHttpServer())
        .get(`/api/v1/ai-cifra/analyses/${job.id}`)
        .expect(200);
      finalJob = jobRes.body.data;

      if (finalJob.status === "completed") break;
      if (finalJob.status === "failed") {
        throw new DomainError(
          `Job falhou (${finalJob.error_code}): ${finalJob.error_message}`,
        );
      }
      if (Date.now() - startAt > analysisTimeoutMs) {
        throw new DomainError(`Job excedeu timeout de ${analysisTimeoutMs}ms`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    expect(finalJob.status).toBe("completed");
    expect(finalJob.result).toBeDefined();

    console.log("[e2e] ai-cifra result:");
    console.log(JSON.stringify(finalJob.result, null, 2));
  });
});
