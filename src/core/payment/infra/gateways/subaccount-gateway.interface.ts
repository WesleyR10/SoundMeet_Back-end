/**
 * Subconta do músico na instituição de pagamento (F1.0).
 *
 * É o que torna possível o modelo de marketplace com split: o dinheiro cai
 * direto na conta do beneficiário, e a plataforma nunca detém recurso alheio.
 */

export type CreateSubaccountRequest = {
  name: string;
  email: string;
  /** CPF ou CNPJ (MEI), só dígitos. */
  cpf_cnpj: string;
  mobile_phone?: string | null;
  birth_date?: string | null;
  /** Endereço é exigido pelo KYC do provedor. */
  address?: {
    street: string;
    number: string;
    province: string;
    postal_code: string;
  } | null;
  external_reference?: string;
};

export type CreateSubaccountResponse = {
  /** Usado no split e nas transferências entre contas. */
  wallet_id: string;
  /**
   * 🔴 **Só vem aqui, uma única vez.** O provedor não a devolve depois — quem
   * perder precisa recriar a subconta, o que significa novo KYC e novo período
   * de avaliação. Guardar cifrada, imediatamente.
   */
  api_key: string;
  account_status: string | null;
};

export interface ISubaccountGateway {
  createSubaccount(
    input: CreateSubaccountRequest,
  ): Promise<CreateSubaccountResponse>;

  /**
   * Liga/desliga a Conta Escrow desta subconta.
   *
   * 🔴 **Desligar LIBERA imediatamente tudo que ainda está sob garantia.** Não
   * é uma configuração inócua: é um pagamento antecipado de shows que talvez
   * não tenham acontecido. O agregado recusa desligar com saldo retido.
   *
   * `days_to_expire` é o prazo após o qual o provedor libera sozinho — casa com
   * o D+2 (plano pago) / D+5 (FREE) já decidido.
   */
  configureEscrow(input: {
    wallet_id: string;
    enabled: boolean;
    days_to_expire?: number;
  }): Promise<void>;
}
