import { InvalidOperationError } from "../../../shared/domain/errors/invalid-operation.error";

/**
 * Resolve a credencial da conta Mercado Pago do beneficiário.
 *
 * Existe como porta para o adapter HTTP não precisar conhecer repositório nem
 * criptografia — ele pede "a credencial deste músico" e recebe, ou não recebe.
 */
export type MercadoPagoAccount = {
  mp_user_id: string;
  access_token: string;
};

export interface IMercadoPagoAccountResolver {
  /** `null` quando o músico ainda não vinculou a conta. */
  resolve(musicianId: string): Promise<MercadoPagoAccount | null>;
}

/**
 * O músico ainda não conectou a conta Mercado Pago.
 *
 * Erro dedicado — e não um `Error` genérico — porque a UI precisa distinguir
 * "falhou" de "falta conectar": o segundo tem uma ação clara e um botão, e
 * tratá-lo como falha genérica mandaria o fã tentar de novo para sempre numa
 * gorjeta que nunca vai passar.
 *
 * 🔴 **Estende `InvalidOperationError`, e isso é o que faz o parágrafo acima
 * valer.** Até 08/set/2026 era `extends Error` puro: o
 * `GlobalExceptionFilter` não o reconhecia, caía no ramo genérico e devolvia
 * **500 `unexpected error`** — exatamente a "falha genérica" que o comentário
 * dizia estar evitando. O efeito era duplo e silencioso: a mensagem acionável
 * nunca chegava ao fã (o corpo de 500 não a carrega) e o monitoramento
 * registrava uma regra de negócio previsível como defeito de servidor.
 *
 * Descoberto rodando `cypress/e2e/audience-tip.cy.ts` contra o backend real —
 * nenhum teste unitário atravessa a fronteira HTTP, então o mapeamento do
 * filtro não era exercido por ninguém.
 */
export class MercadoPagoAccountNotLinkedError extends InvalidOperationError {
  constructor(readonly musician_id: string) {
    super("Este artista ainda não conectou uma conta para receber gorjetas.", {
      metadata: { musician_id: musicianId(musician_id) },
    });
    this.name = "MercadoPagoAccountNotLinkedError";
  }
}

/** Só para o `metadata` não carregar `undefined` quando o id vier vazio. */
function musicianId(value: string): string {
  return value || "desconhecido";
}
