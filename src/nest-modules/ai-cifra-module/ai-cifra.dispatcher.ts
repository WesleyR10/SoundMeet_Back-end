import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { OnModuleDestroy } from "@nestjs/common";
import { execFile } from "child_process";
import os from "os";
import { promisify } from "util";

import {
  AiCifraAnalysisEnqueueCommand,
  IAiCifraAnalysisDispatcher,
} from "../../core/ai-cifra/application/ports/ai-cifra-analysis-dispatcher.interface";
import { FailAiCifraAnalysisJobUseCase } from "../../core/ai-cifra/application/use-cases/fail-ai-cifra-analysis-job/fail-ai-cifra-analysis-job.use-case";
import {
  AiCifraAnalysisRetryableError,
  ProcessAiCifraAnalysisJobUseCase,
} from "../../core/ai-cifra/application/use-cases/process-ai-cifra-analysis-job/process-ai-cifra-analysis-job.use-case";
import { AI_CIFRA_RABBITMQ } from "./rabbitmq/ai-cifra.rabbitmq";

const execFileAsync = promisify(execFile);

type AiCifraDispatcherBackpressureConfig = {
  maxQueueSize: number;
  enqueueRetryDelayMs: number;
  tickDelayMs: number;
  maxRssMb: number | null;
  maxLoadAvg1: number | null;
  gpuMaxMemoryPercent: number | null;
  gpuCheckIntervalMs: number;
};

export class AiCifraNoopDispatcher implements IAiCifraAnalysisDispatcher {
  async enqueue(_command: AiCifraAnalysisEnqueueCommand): Promise<void> {}
}

export class AiCifraAnalysisDispatcher
  implements IAiCifraAnalysisDispatcher, OnModuleDestroy
{
  private queue: AiCifraAnalysisEnqueueCommand[] = [];
  private queued = new Set<string>();
  private blockedByBackpressure = new Set<string>();
  private runningCount = 0;
  private retryCounts = new Map<string, number>();

  private destroyed = false;
  private timeouts = new Set<NodeJS.Timeout>();

  private tickTimer: NodeJS.Timeout | null = null;
  private gpuLastCheckAt = 0;
  private gpuOverloaded = false;
  private gpuCheckPromise: Promise<void> | null = null;

  private readonly backpressure: AiCifraDispatcherBackpressureConfig;

  constructor(
    private readonly processUseCase: ProcessAiCifraAnalysisJobUseCase,
    private readonly failUseCase: FailAiCifraAnalysisJobUseCase,
    private readonly concurrency: number,
    backpressure?: Partial<AiCifraDispatcherBackpressureConfig>,
  ) {
    this.backpressure = {
      maxQueueSize: backpressure?.maxQueueSize ?? 250,
      enqueueRetryDelayMs: backpressure?.enqueueRetryDelayMs ?? 250,
      tickDelayMs: backpressure?.tickDelayMs ?? 250,
      maxRssMb:
        typeof backpressure?.maxRssMb === "number"
          ? backpressure.maxRssMb
          : null,
      maxLoadAvg1:
        typeof backpressure?.maxLoadAvg1 === "number"
          ? backpressure.maxLoadAvg1
          : null,
      gpuMaxMemoryPercent:
        typeof backpressure?.gpuMaxMemoryPercent === "number"
          ? backpressure.gpuMaxMemoryPercent
          : null,
      gpuCheckIntervalMs: backpressure?.gpuCheckIntervalMs ?? 2000,
    };
  }

  onModuleDestroy() {
    this.destroyed = true;
    if (this.tickTimer) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
    for (const timer of this.timeouts) {
      clearTimeout(timer);
    }
    this.timeouts.clear();
    this.queue = [];
    this.queued.clear();
    this.blockedByBackpressure.clear();
    this.retryCounts.clear();
  }

  private scheduleTimeout(
    callback: () => void,
    delayMs: number,
  ): NodeJS.Timeout {
    const timer = setTimeout(() => {
      this.timeouts.delete(timer);
      if (this.destroyed) {
        return;
      }
      callback();
    }, delayMs);
    this.timeouts.add(timer);
    return timer;
  }

  async enqueue(command: AiCifraAnalysisEnqueueCommand): Promise<void> {
    if (this.destroyed) {
      return;
    }

    const job_id = command.job_id;
    if (this.queued.has(job_id)) {
      return;
    }

    if (this.blockedByBackpressure.has(job_id)) {
      return;
    }

    if (this.queue.length >= this.backpressure.maxQueueSize) {
      this.blockedByBackpressure.add(job_id);
      const jitter = Math.floor(Math.random() * 250);
      this.scheduleTimeout(() => {
        this.blockedByBackpressure.delete(job_id);
        void this.enqueue(command);
      }, this.backpressure.enqueueRetryDelayMs + jitter);
      return;
    }

    this.queued.add(job_id);
    this.queue.push(command);
    this.tick();
  }

  private scheduleTick(delayMs: number): void {
    if (this.destroyed) {
      return;
    }
    if (this.tickTimer) {
      return;
    }
    this.tickTimer = this.scheduleTimeout(() => {
      this.tickTimer = null;
      this.tick();
    }, delayMs);
  }

  private shouldBackpressureNow(): boolean {
    if (this.destroyed) {
      return true;
    }
    const maxRssMb = this.backpressure.maxRssMb;
    if (
      typeof maxRssMb === "number" &&
      Number.isFinite(maxRssMb) &&
      maxRssMb > 0
    ) {
      const rssMb = process.memoryUsage().rss / (1024 * 1024);
      if (rssMb >= maxRssMb) {
        return true;
      }
    }

    const maxLoadAvg1 = this.backpressure.maxLoadAvg1;
    if (
      typeof maxLoadAvg1 === "number" &&
      Number.isFinite(maxLoadAvg1) &&
      maxLoadAvg1 > 0
    ) {
      const load1 = os.loadavg()[0] ?? 0;
      if (load1 >= maxLoadAvg1) {
        return true;
      }
    }

    if (
      typeof this.backpressure.gpuMaxMemoryPercent === "number" &&
      Number.isFinite(this.backpressure.gpuMaxMemoryPercent) &&
      this.backpressure.gpuMaxMemoryPercent > 0
    ) {
      this.ensureGpuCheck();
      if (this.gpuOverloaded) {
        return true;
      }
    }

    return false;
  }

  private ensureGpuCheck(): void {
    const maxPercent = this.backpressure.gpuMaxMemoryPercent;
    if (
      typeof maxPercent !== "number" ||
      !Number.isFinite(maxPercent) ||
      maxPercent <= 0
    ) {
      return;
    }
    if (this.gpuCheckPromise) {
      return;
    }
    const now = Date.now();
    if (now - this.gpuLastCheckAt < this.backpressure.gpuCheckIntervalMs) {
      return;
    }
    this.gpuLastCheckAt = now;
    this.gpuCheckPromise = this.checkGpuMemory(maxPercent)
      .then((overloaded) => {
        this.gpuOverloaded = overloaded;
      })
      .catch(() => {
        this.gpuOverloaded = false;
      })
      .finally(() => {
        this.gpuCheckPromise = null;
      });
  }

  private async checkGpuMemory(maxPercent: number): Promise<boolean> {
    try {
      const result = await execFileAsync(
        "nvidia-smi",
        [
          "--query-gpu=memory.used,memory.total",
          "--format=csv,noheader,nounits",
        ],
        { timeout: 500 },
      );

      const raw = `${result.stdout ?? ""}`.trim();
      if (!raw) {
        return false;
      }
      const lines = raw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (!lines.length) {
        return false;
      }

      const percents = lines
        .map((l) => l.split(",").map((p) => p.trim()))
        .map(([used, total]) => {
          const usedMb = Number(used);
          const totalMb = Number(total);
          if (
            !Number.isFinite(usedMb) ||
            !Number.isFinite(totalMb) ||
            totalMb <= 0
          ) {
            return null;
          }
          return (usedMb / totalMb) * 100;
        })
        .filter((v): v is number => typeof v === "number");

      if (!percents.length) {
        return false;
      }
      const maxUsedPercent = Math.max(...percents);
      return maxUsedPercent >= maxPercent;
    } catch {
      return false;
    }
  }

  private tick(): void {
    if (this.destroyed) {
      return;
    }
    if (this.shouldBackpressureNow()) {
      this.scheduleTick(this.backpressure.tickDelayMs);
      return;
    }

    while (this.runningCount < this.concurrency && this.queue.length > 0) {
      if (this.shouldBackpressureNow()) {
        this.scheduleTick(this.backpressure.tickDelayMs);
        return;
      }
      const command = this.queue.shift()!;
      const job_id = command.job_id;
      this.runningCount += 1;
      Promise.resolve()
        .then(() => this.processUseCase.execute({ job_id }))
        .catch((error) => {
          if (error instanceof AiCifraAnalysisRetryableError) {
            const current = this.retryCounts.get(job_id) ?? 0;
            const next = current + 1;
            this.retryCounts.set(job_id, next);

            const max = 5;
            if (next <= max) {
              const base = 1000;
              const backoff = Math.min(60_000, base * 2 ** (next - 1));
              const jitter = Math.floor(Math.random() * 250);
              this.scheduleTimeout(() => {
                this.enqueue(command);
              }, backoff + jitter);
            } else {
              this.retryCounts.delete(job_id);
              void this.failUseCase.execute({
                job_id,
                error_code: "AI_CIFRA_MAX_RETRIES_EXCEEDED",
                error_message: `Falha após ${max} tentativas: ${error.message}`,
                details: error.code,
              });
            }
          }
        })
        .finally(() => {
          this.runningCount -= 1;
          this.queued.delete(job_id);
          this.tick();
        });
    }
  }
}

export class AiCifraRabbitmqDispatcher implements IAiCifraAnalysisDispatcher {
  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly routingKey: string,
  ) {}

  async enqueue(command: AiCifraAnalysisEnqueueCommand): Promise<void> {
    await this.amqpConnection.publish(
      AI_CIFRA_RABBITMQ.exchange,
      this.routingKey,
      command,
      {
        messageId: command.job_id,
        persistent: true,
      },
    );
  }
}
