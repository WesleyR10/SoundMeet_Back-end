import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import {
  AiAudioSeparationJobSearchParams,
  IAiAudioSeparationJobRepository,
} from "../../../domain/ai-audio-separation-job.repository";
import { IAiAudioStorage } from "../../ports/ai-audio-storage.interface";

/** Lote pequeno: a varredura divide storage e banco com o caminho quente. */
const PAGE_SIZE = 100;

export type PurgeExpiredAiAudioStemsInput = Record<string, never>;

export type PurgeExpiredAiAudioStemsOutput = {
  cutoff: Date;
  jobs_expired: number;
  objects_deleted: number;
};

/**
 * Apaga do storage os stems cujo prazo de retenção venceu.
 *
 * ## Por que esta varredura existe
 *
 * O `ai-cifra` nunca retém a gravação — apaga o objeto assim que a análise
 * conclui e guarda só a folha de cifra. O `ai-audio` não tinha política
 * nenhuma: cada separação gravava quatro arquivos de áudio que ficavam para
 * sempre. Isso é storage sem teto e, mais sério, uma postura de direito autoral
 * diferente da que o resto do projeto escolheu: **stem é a gravação**,
 * separada, não um dado derivado como uma folha de acordes.
 *
 * ## O job vira `expired`, não `failed`, e não é apagado
 *
 * O registro sobrevive ao áudio. O app precisa distinguir "deu erro, tente de
 * novo" de "o prazo venceu, é só pedir de novo" — e um job `completed` com URLs
 * que respondem 404 é a pior resposta possível para quem abriu o app para
 * ensaiar.
 *
 * ## Ordem: storage primeiro, banco depois
 *
 * Marcar `expired` antes de apagar deixaria objeto órfão no bucket se o
 * processo morresse no meio — invisível, cobrado, e sem nada apontando para
 * ele. Falha ao apagar um objeto não interrompe o lote (o storage pode já ter
 * perdido aquele arquivo), mas impede que o job seja marcado, para a próxima
 * passada tentar de novo.
 */
export class PurgeExpiredAiAudioStemsUseCase implements IUseCase<
  PurgeExpiredAiAudioStemsInput,
  PurgeExpiredAiAudioStemsOutput
> {
  constructor(
    private readonly jobRepo: IAiAudioSeparationJobRepository,
    private readonly storage: IAiAudioStorage,
    private readonly clock: IClock = { now: () => new Date() },
  ) {}

  async execute(
    _input: PurgeExpiredAiAudioStemsInput = {} as PurgeExpiredAiAudioStemsInput,
  ): Promise<PurgeExpiredAiAudioStemsOutput> {
    const cutoff = this.clock.now();

    let jobs_expired = 0;
    let objects_deleted = 0;

    while (true) {
      // Sempre página 1: cada job varrido sai do conjunto de resultados ao
      // virar `expired`. Paginar avançando puraria metade do lote a cada
      // passada.
      const result = await this.jobRepo.search(
        AiAudioSeparationJobSearchParams.create({
          page: 1,
          per_page: PAGE_SIZE,
          sort: "stems_expire_at",
          sort_dir: "asc",
          filter: {
            status: "completed",
            stems_expire_at_lte: cutoff,
          },
        }),
      );

      if (!result.items.length) {
        break;
      }

      let expiredThisPass = 0;

      for (const job of result.items) {
        let allDeleted = true;

        for (const output of job.outputs) {
          try {
            await this.storage.deleteObject({ object_key: output.object_key });
            objects_deleted += 1;
          } catch {
            allDeleted = false;
          }
        }

        if (!allDeleted) {
          // Deixa para a próxima passada. Marcar assim mesmo perderia o
          // ponteiro para um objeto que continua no bucket.
          continue;
        }

        job.expireStems();
        await this.jobRepo.update(job);
        jobs_expired += 1;
        expiredThisPass += 1;
      }

      // Nada avançou NESTA volta (todos falharam ao apagar) — sair evita laço
      // infinito sobre o mesmo lote. Tem de ser o contador da passada, não o
      // acumulado: com o acumulado, um lote inteiro de falhas depois de um lote
      // bem-sucedido giraria para sempre.
      if (expiredThisPass === 0) {
        break;
      }

      if (result.items.length < PAGE_SIZE) {
        break;
      }
    }

    return { cutoff, jobs_expired, objects_deleted };
  }
}
