/**
 * Custódia do cachê na instituição de pagamento.
 *
 * 🔴 **A porta existe para que o dinheiro NUNCA transite pelo patrimônio da
 * SoundMeet.** A cláusula `papel_da_plataforma.com_custodia`, já assinada,
 * afirma isso — implementar custódia como "saldo lógico numa conta nossa"
 * transformaria cláusula assinada em declaração falsa, além de ser atividade
 * regulada. Qualquer adapter novo tem que manter a propriedade: o valor fica na
 * subconta do beneficiário, bloqueado.
 *
 * O domínio (`BookingEscrow`) é idêntico em qualquer provedor — só o adapter
 * muda. Ver `pesquisa-de-gateways-2026-08.md`.
 */

export type EscrowChargeRequest = {
  /** Subconta do beneficiário (`walletId`), não a conta da plataforma. */
  beneficiary_wallet_id: string;
  amount: number;
  /** Comissão da plataforma, separada no split do recebimento. */
  platform_fee: number;
  /**
   * O que vai para a subconta do beneficiário — `amount − platform_fee`, já
   * calculado em centavos inteiros por `splitAmountInCents`.
   *
   * Vem pronto de propósito: refazer a subtração no adapter criaria uma segunda
   * fonte de verdade sobre o número que chega ao provedor, e é exatamente onde
   * um centavo se perde entre a nossa conta e a dele.
   */
  net_amount: number;
  /** Referência nossa, para reconciliar o webhook. */
  external_reference: string;
  description?: string;
  due_date?: Date;
};

export type EscrowChargeResponse = {
  /** Id da cobrança no provedor — a âncora de tudo que vier depois. */
  external_id: string;
  status: string;
  /** Quando a liberação automática vence (`daysToExpire` do provedor). */
  expires_at: Date | null;
  /** QR/copia-e-cola para o estabelecimento pagar. */
  payment_payload?: string | null;
};

export interface IBookingEscrowGateway {
  /** Cria a cobrança já com a garantia (custódia) ligada. */
  createEscrowCharge(input: EscrowChargeRequest): Promise<EscrowChargeResponse>;

  /**
   * Procura uma cobrança já criada pela NOSSA referência.
   *
   * 🔴 **É o que impede cobrar duas vezes o mesmo show.** Existe uma janela
   * entre o provedor aceitar a cobrança e nós gravarmos o `external_id`: se o
   * processo morrer ali, o banco fica idêntico ao caso "nunca cobramos", e uma
   * retomada ingênua emitiria um segundo PIX para o mesmo booking — que o
   * estabelecimento poderia pagar. Consultar antes de criar fecha a janela.
   *
   * `null` quando não há cobrança para a referência.
   */
  findChargeByReference(
    externalReference: string,
  ): Promise<EscrowChargeResponse | null>;

  /**
   * Libera antecipadamente uma garantia.
   *
   * O provedor libera sozinho na expiração; esta chamada é para o caminho
   * rápido — check-in feito e prazo de contestação vencido antes do
   * `daysToExpire`.
   */
  releaseEscrow(externalId: string): Promise<void>;

  /** Devolve ao pagador. */
  refundEscrow(externalId: string, reason: string): Promise<void>;
}
