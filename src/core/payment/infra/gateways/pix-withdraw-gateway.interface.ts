export type PixWithdrawRequest = {
  amount: number;
  pix_key: string;
  pix_key_type: string;
  description?: string;
  external_reference?: string;
};

export type PixWithdrawResponse = {
  transfer_id: string;
  status: string;
};

/**
 * O provedor **recusou** a transferência, e recusou de forma conclusiva:
 * chave PIX inválida, conta bloqueada, limite excedido, credencial errada.
 *
 * 🔴 A distinção entre isto e um erro qualquer é dinheiro de verdade. Um
 * timeout ou um 5xx **não** significam que a transferência não saiu — a
 * requisição pode ter chegado e sido processada com a resposta perdida no
 * caminho. Estornar o saldo nesse caso devolveria fundo sacável de um saque
 * que talvez já esteja a caminho da conta do músico, trocando o duplo
 * pagamento que o lock acabou de fechar por outro, pela porta dos fundos.
 *
 * Só o que é conclusivamente uma recusa vira esta exceção; todo o resto sobe
 * como erro comum e mantém a transação `pending` para a reconciliação decidir.
 */
export class PixWithdrawRejectedError extends Error {
  constructor(
    message: string,
    readonly provider_code?: string,
  ) {
    super(message);
    this.name = "PixWithdrawRejectedError";
  }
}

export interface IPixWithdrawGateway {
  withdraw(input: PixWithdrawRequest): Promise<PixWithdrawResponse>;
  /**
   * A transferência criada para esta referência externa, se existir.
   *
   * É o desempate do caso indeterminado: quando `withdraw` falha sem dizer se
   * chegou a criar algo, uma consulta pela referência que nós mesmos geramos
   * responde a única pergunta que importa — o dinheiro saiu ou não? Sem ela, a
   * escolha seria entre estornar às cegas (arriscando pagamento duplo) e
   * deixar o saldo preso indefinidamente.
   *
   * Opcional porque nem todo provedor oferece a consulta; sem ela o use-case
   * cai no lado seguro (mantém `pending` e pede reconciliação manual).
   */
  findTransferByExternalReference?(
    externalReference: string,
  ): Promise<PixWithdrawResponse | null>;
}
