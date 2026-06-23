import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  AiCifraUploadSearchParams,
  IAiCifraUploadRepository,
} from "../../../domain/ai-cifra-upload.repository";
import { IAiCifraStorage } from "../../ports/ai-cifra-storage.interface";

export class PurgeStaleAiCifraUploadsUseCase implements IUseCase<
  PurgeStaleAiCifraUploadsInput,
  PurgeStaleAiCifraUploadsOutput
> {
  constructor(
    private readonly uploadRepo: IAiCifraUploadRepository,
    private readonly storage: IAiCifraStorage,
    private readonly ttlMinutes: number,
    private readonly clock: IClock = { now: () => new Date() },
  ) {}

  async execute(
    _input: PurgeStaleAiCifraUploadsInput = {},
  ): Promise<PurgeStaleAiCifraUploadsOutput> {
    const ttlMs = Math.max(1, Math.floor(this.ttlMinutes)) * 60 * 1000;
    const cutoff = new Date(this.clock.now().getTime() - ttlMs);

    let candidates = 0;
    let delete_attempts = 0;

    const statuses = ["uploaded", "analysis_queued", "analyzing"] as const;

    for (const status of statuses) {
      let page = 1;
      while (true) {
        const result = await this.uploadRepo.search(
          AiCifraUploadSearchParams.create({
            page,
            per_page: 100,
            sort: "updated_at",
            sort_dir: "asc",
            filter: {
              status,
              updated_at_lte: cutoff,
            },
          }),
        );

        if (!result.items.length) {
          break;
        }

        candidates += result.items.length;
        for (const upload of result.items) {
          delete_attempts += 1;
          await this.storage
            .deleteObject({ object_key: upload.object_key })
            .catch(() => undefined);
        }

        if (page >= result.last_page) {
          break;
        }
        page += 1;
      }
    }

    return {
      cutoff,
      ttl_minutes: this.ttlMinutes,
      candidates,
      delete_attempts,
    };
  }
}

export type PurgeStaleAiCifraUploadsInput = Record<string, never>;

export type PurgeStaleAiCifraUploadsOutput = {
  ttl_minutes: number;
  cutoff: Date;
  candidates: number;
  delete_attempts: number;
};
