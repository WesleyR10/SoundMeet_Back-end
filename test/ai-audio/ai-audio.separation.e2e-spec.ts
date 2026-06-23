import AWS from "aws-sdk";
import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";

import { DomainError } from "../../src/core/shared/domain/errors/domain.error";
import { AiAudioModule } from "../../src/nest-modules/ai-audio-module/ai-audio.module";
import { ConfigModuleRoot } from "../../src/nest-modules/config-module/config-module.module";
import { PrismaService } from "../../src/nest-modules/database-module/prisma/prisma.service";
import { startApp } from "../../src/nest-modules/shared-module/testing/helpers";

const DEFAULT_MODELS = [
  "htdemucs_4stems",
  "htdemucs_6stems",
  "mdx23c",
  "bs_roformer",
] as const;

const SLOW_MODELS = new Set(["bs_roformer"]);

const DEFAULT_AUDIO_FILE_PATH = path.resolve(
  process.cwd(),
  "Nós Dois - Lourena.mp3",
);

let generatedAudioTempDir: string | null = null;

function createTempSineWavFile(seconds = 1): string {
  const sampleRate = 44100;
  const frequency = 440;
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = sampleRate * seconds * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < sampleRate * seconds; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t);
    const value = Math.max(-1, Math.min(1, sample));
    const int16 = Math.round(value * 32767);
    buffer.writeInt16LE(int16, 44 + i * 2);
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "soundmeet-ai-audio-"));
  generatedAudioTempDir = dir;
  const outPath = path.join(dir, "sine.wav");
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

function guessContentTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".wav") return "audio/wav";
  if (ext === ".flac") return "audio/flac";
  if (ext === ".ogg") return "audio/ogg";
  return "audio/mpeg";
}

function resolveAudioFile(): { filePath: string; contentType: string } {
  const envFile = (process.env.AI_AUDIO_E2E_FILE ?? "").trim();
  const filePath = envFile || DEFAULT_AUDIO_FILE_PATH;
  if (fs.existsSync(filePath)) {
    return { filePath, contentType: guessContentTypeFromPath(filePath) };
  }

  const generated = createTempSineWavFile(1);
  return { filePath: generated, contentType: "audio/wav" };
}

function buildS3ClientFromEnv(): { s3: AWS.S3; bucket: string } {
  const provider = (process.env.AI_AUDIO_STORAGE_PROVIDER ?? "minio").trim();
  const region = process.env.AWS_REGION ?? "us-east-1";

  if (provider === "cloudflare_r2") {
    const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT!;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
    const bucket = process.env.CLOUDFLARE_R2_BUCKET!;
    const s3 = new AWS.S3({
      apiVersion: "2006-03-01",
      signatureVersion: "v4",
      region,
      endpoint,
      accessKeyId,
      secretAccessKey,
      s3ForcePathStyle: true,
    });
    return { s3, bucket };
  }

  const port = Number(process.env.MINIO_PORT ?? 9000);
  const s3Port = port === 9001 ? 9000 : port;
  const minioEndpoint = (process.env.MINIO_ENDPOINT ?? "localhost").trim();
  const accessKeyId = process.env.MINIO_ACCESS_KEY ?? "soundmeet";
  const secretAccessKey = process.env.MINIO_SECRET_KEY ?? "soundmeet123";
  const bucket = process.env.MINIO_BUCKET ?? "soundmeet-media";

  const s3 = new AWS.S3({
    apiVersion: "2006-03-01",
    signatureVersion: "v4",
    region,
    endpoint: `http://${minioEndpoint}:${s3Port}`,
    accessKeyId,
    secretAccessKey,
    s3ForcePathStyle: true,
  });
  return { s3, bucket };
}

async function ensureBucketExists(s3: AWS.S3, bucket: string) {
  try {
    await s3.createBucket({ Bucket: bucket }).promise();
  } catch (error: any) {
    const code = `${error?.code ?? ""}`;
    if (
      code !== "BucketAlreadyOwnedByYou" &&
      code !== "BucketAlreadyExists" &&
      code !== "InvalidBucketState"
    ) {
      throw error;
    }
  }
}

function parseModelsFromEnv(): string[] {
  const raw = process.env.AI_AUDIO_E2E_MODEL_IDS ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : [...DEFAULT_MODELS];
}

function filterAllowedModels(models: string[]): string[] {
  const allowed = new Set<string>(DEFAULT_MODELS);
  const filtered = models.map((m) => m.trim()).filter((m) => allowed.has(m));
  return filtered.length ? filtered : [...DEFAULT_MODELS];
}

function isTruthy(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

async function resolveModelsForRuntime(requested: string[]): Promise<string[]> {
  const allowSlowOnCpu = isTruthy(process.env.AI_AUDIO_E2E_ALLOW_SLOW_MODELS);
  const baseURL = (process.env.AI_AUDIO_SEPARATION_HTTP_BASE_URL ?? "").trim();
  if (!baseURL) return requested;

  try {
    const res = await axios.get(`${baseURL}/v1/info`, { timeout: 3000 });
    const cudaAvailable = Boolean(res.data?.cuda_available);
    if (cudaAvailable) return requested;
    if (allowSlowOnCpu) return requested;
    return requested.filter((m) => !SLOW_MODELS.has(m));
  } catch {
    return allowSlowOnCpu
      ? requested
      : requested.filter((m) => !SLOW_MODELS.has(m));
  }
}

function parseOutputFormatFromEnv(): "wav" | "flac" | "mp3" | undefined {
  const raw = (process.env.AI_AUDIO_E2E_OUTPUT_FORMAT ?? "")
    .trim()
    .toLowerCase();
  if (raw === "wav" || raw === "flac" || raw === "mp3") return raw;
  return undefined;
}

type ModelResult = {
  model_id: string;
  job_id: string;
  seconds: number;
  outputs: number;
};

describe("AI Audio Benchmark (e2e)", () => {
  jest.setTimeout(60 * 60 * 1000);
  const appHelper = startApp({
    imports: [ConfigModuleRoot.forRoot(), AiAudioModule],
  });

  beforeAll(async () => {
    const { s3, bucket } = buildS3ClientFromEnv();
    await ensureBucketExists(s3, bucket);
  });

  afterAll(() => {
    if (generatedAudioTempDir) {
      fs.rmSync(generatedAudioTempDir, { recursive: true, force: true });
      generatedAudioTempDir = null;
    }
  });

  it("executa separação com htdemucs_4stems (1 requisição)", async () => {
    const musician_id = "3d2f7f8a-20f4-4d6a-9dbe-f5a76c0bfe61";
    const { filePath: audioFilePath, contentType } = resolveAudioFile();
    const output_format = parseOutputFormatFromEnv();

    console.log(
      `[e2e] start model=htdemucs_4stems file=${path.basename(audioFilePath)} content_type=${contentType} output_format=${output_format ?? "default"}`,
    );

    if (!fs.existsSync(audioFilePath)) {
      throw new DomainError(
        `Arquivo de áudio não encontrado: ${audioFilePath}`,
      );
    }

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

    const uploadStartAt = Date.now();
    const uploadRes = await request(appHelper.app.getHttpServer())
      .post(`/api/v1/musicians/${musician_id}/ai-audio/uploads`)
      .attach("file", audioFilePath, {
        filename: path.basename(audioFilePath),
        contentType,
      })
      .expect(201);

    const upload = uploadRes.body.data;
    console.log(
      `[e2e] upload_done upload_id=${upload.id} seconds=${((Date.now() - uploadStartAt) / 1000).toFixed(1)}`,
    );
    const model_id = "htdemucs_4stems";
    const separationPayload: {
      model_id: string;
      output_format?: "wav" | "flac" | "mp3";
    } = {
      model_id,
      ...(output_format ? { output_format } : {}),
    };

    const runSeparationOnce = async (runLabel: string) => {
      const startAt = Date.now();
      const modelTimeoutMs = Number(
        process.env.AI_AUDIO_E2E_MODEL_TIMEOUT_MS ?? 60 * 60 * 1000,
      );

      const separationRes = await request(appHelper.app.getHttpServer())
        .post(`/api/v1/ai-audio/uploads/${upload.id}/separations`)
        .send(separationPayload)
        .expect(201);

      const job = separationRes.body.data;
      console.log(
        `[e2e] separation_created job_id=${job.id} model=${model_id}`,
      );
      let finalJob: any;
      for (let attempt = 0; attempt < 10_000; attempt++) {
        const jobRes = await request(appHelper.app.getHttpServer())
          .get(`/api/v1/ai-audio/separations/${job.id}`)
          .expect(200);
        finalJob = jobRes.body.data;

        if (finalJob.status === "completed") break;
        if (finalJob.status === "failed") {
          throw new DomainError(
            `Job (${model_id}) falhou (${finalJob.error_code}): ${finalJob.error_message}`,
          );
        }
        if (Date.now() - startAt > modelTimeoutMs) {
          throw new DomainError(
            `Job (${model_id}) excedeu timeout de ${modelTimeoutMs}ms`,
          );
        }
        await new Promise((r) => setTimeout(r, 5000));
      }

      const seconds = (Date.now() - startAt) / 1000;
      console.log(
        `[e2e] run=${runLabel} model=${model_id} status=${finalJob.status} seconds=${seconds.toFixed(1)}`,
      );

      expect(finalJob.status).toBe("completed");
      expect(Array.isArray(finalJob.outputs)).toBe(true);

      return { seconds, finalJob };
    };

    await runSeparationOnce("1");
  });

  // it("mede duração por modelo (1 por vez) e imprime resumo", async () => {
  //   const musician_id = "3d2f7f8a-20f4-4d6a-9dbe-f5a76c0bfe61";
  //   const { filePath: audioFilePath, contentType } = resolveAudioFile();
  //   const model_ids = parseModelsFromEnv();
  //   const output_format = parseOutputFormatFromEnv();
  //
  //   if (!fs.existsSync(audioFilePath)) {
  //     throw new Error(`Arquivo de áudio não encontrado: ${audioFilePath}`);
  //   }
  //
  //   const prisma = appHelper.app.get(PrismaService);
  //   await prisma.musician.upsert({
  //     where: { id: musician_id },
  //     update: {},
  //     create: {
  //       id: musician_id,
  //       email: `e2e+${musician_id}@soundmeet.local`,
  //       name: "E2E Musician",
  //     },
  //   });
  //
  //   const uploadRes = await request(appHelper.app.getHttpServer())
  //     .post(`/api/v1/musicians/${musician_id}/ai-audio/uploads`)
  //     .attach("file", audioFilePath, {
  //       filename: path.basename(audioFilePath),
  //       contentType,
  //     })
  //     .expect(201);
  //
  //   const upload = uploadRes.body.data;
  //   const results: ModelResult[] = [];
  //
  //   for (const model_id of model_ids) {
  //     const startAt = Date.now();
  //     const modelTimeoutMs = Number(
  //       process.env.AI_AUDIO_E2E_MODEL_TIMEOUT_MS ?? 60 * 60 * 1000,
  //     );
  //     console.log(`[bench] start model=${model_id} upload_id=${upload.id}`);
  //
  //     const separationRes = await request(appHelper.app.getHttpServer())
  //       .post(`/api/v1/ai-audio/uploads/${upload.id}/separations`)
  //       .send({ model_id, output_format })
  //       .expect(201);
  //
  //     const job = separationRes.body.data;
  //     let finalJob: any;
  //     for (let attempt = 0; attempt < 10_000; attempt++) {
  //       const jobRes = await request(appHelper.app.getHttpServer())
  //         .get(`/api/v1/ai-audio/separations/${job.id}`)
  //         .expect(200);
  //       finalJob = jobRes.body.data;
  //       if (finalJob.status === "completed") break;
  //       if (finalJob.status === "failed") {
  //         throw new Error(
  //           `Job (${model_id}) falhou (${finalJob.error_code}): ${finalJob.error_message}`,
  //         );
  //       }
  //       if (Date.now() - startAt > modelTimeoutMs) {
  //         throw new Error(
  //           `Job (${model_id}) excedeu timeout de ${modelTimeoutMs}ms`,
  //         );
  //       }
  //       await new Promise((r) => setTimeout(r, 5000));
  //     }
  //
  //     const seconds = (Date.now() - startAt) / 1000;
  //     results.push({
  //       model_id,
  //       job_id: job.id,
  //       seconds,
  //       outputs: (finalJob.outputs ?? []).length,
  //     });
  //     console.log(
  //       `[bench] done model=${model_id} seconds=${seconds.toFixed(1)}`,
  //     );
  //   }
  //
  //   const summaryPath = path.join(
  //     os.tmpdir(),
  //     `soundmeet-ai-audio-benchmark-${Date.now()}.json`,
  //   );
  //   fs.writeFileSync(
  //     summaryPath,
  //     JSON.stringify({ upload_id: upload.id, results }, null, 2),
  //   );
  //   console.log(`[bench] summary_file=${summaryPath}`);
  //   console.log(`[bench] results=${JSON.stringify(results)}`);
  // });
});
