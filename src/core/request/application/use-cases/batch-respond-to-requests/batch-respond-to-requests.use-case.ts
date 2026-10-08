import { IUseCase } from "../../../../shared/application/use-case.interface";
import { RequestOutput } from "../common/request-output";
import {
  RespondToRequestAction,
  RespondToRequestInput,
} from "../respond-to-request/respond-to-request.input";
import { RespondToRequestUseCase } from "../respond-to-request/respond-to-request.use-case";

/** Teto de itens por chamada — ver comentário em `execute`. */
export const BATCH_RESPOND_MAX_ITEMS = 50;

export type BatchRespondToRequestsInput = {
  request_ids: string[];
  musician_id: string;
  action: RespondToRequestAction;
  rejection_reason?: string;
};

export type BatchRespondFailure = {
  request_id: string;
  reason: string;
};

export type BatchRespondToRequestsOutput = {
  succeeded: RequestOutput[];
  failed: BatchRespondFailure[];
};

/**
 * Responde vários pedidos de uma vez (Bloco 9.4c).
 *
 * O músico volta do intervalo com dezenas de pedidos acumulados; responder um
 * a um, no palco, com uma mão livre, não é um fluxo real.
 *
 * **Best-effort, não atômico** — decisão registrada em `debate-de-funcionalidades.md`.
 * Um pedido que já foi respondido por outra aba, ou que expirou, não pode
 * anular a resposta dos outros 29. Cada falha volta identificada por
 * `request_id` para o app marcar só aquele item.
 *
 * Reusa `RespondToRequestUseCase` item a item de propósito: é lá que moram a
 * checagem de destinatário, a transição de estado e os eventos de domínio
 * (gamificação, push). Reimplementar em lote duplicaria justamente a parte
 * que não pode divergir.
 */
export class BatchRespondToRequestsUseCase implements IUseCase<
  BatchRespondToRequestsInput,
  BatchRespondToRequestsOutput
> {
  constructor(
    private readonly respondToRequestUseCase: RespondToRequestUseCase,
  ) {}

  async execute(
    input: BatchRespondToRequestsInput,
  ): Promise<BatchRespondToRequestsOutput> {
    // Duplicatas viram uma tentativa só: a segunda falharia com "não está
    // pendente" e poluiria o relatório com um erro que o usuário não causou.
    const uniqueIds = [...new Set(input.request_ids)];

    const succeeded: RequestOutput[] = [];
    const failed: BatchRespondFailure[] = [];

    // Sequencial, não Promise.all: cada item escreve no mesmo agregado de
    // gamificação do músico e dispara eventos de domínio. Paralelizar aqui
    // trocaria uma espera de milissegundos por corrida de escrita.
    for (const requestId of uniqueIds) {
      try {
        const output = await this.respondToRequestUseCase.execute(
          new RespondToRequestInput({
            request_id: requestId,
            musician_id: input.musician_id,
            action: input.action,
            rejection_reason: input.rejection_reason,
          }),
        );
        succeeded.push(output);
      } catch (error) {
        failed.push({
          request_id: requestId,
          reason: describeFailure(error),
        });
      }
    }

    return { succeeded, failed };
  }
}

/**
 * Mensagem curta e sem stack: o relatório volta para o app e não deve
 * carregar detalhe interno de infraestrutura.
 */
function describeFailure(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Não foi possível responder a este pedido.";
}
