import { MusicianWallet } from "../../../domain/musician-wallet.aggregate";

export type MusicianWalletOutput = {
  id: string;
  musician_id: string;
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  pix_key: string | null;
  bank_account: any | null;
  is_active: boolean;
  /**
   * Cachê sob custódia — recebido, ainda **não** liberado.
   *
   * Fora de `balance` de propósito: retido não é sacável. A UI mostra os dois
   * separados, senão anunciaria um saque que o gateway recusa.
   */
  held_balance: number;
  /**
   * A conta Mercado Pago está vinculada?
   *
   * É o que a UI usa para decidir entre "conectar para receber gorjetas" e o
   * extrato. 🔴 O `mp_user_id` e os tokens **não** saem daqui — só o booleano.
   */
  mp_linked: boolean;
  created_at: Date;
  updated_at: Date;
};

export class MusicianWalletOutputMapper {
  static toOutput(entity: MusicianWallet): MusicianWalletOutput {
    const { wallet_id, mp_user_id: _mpUserId, ...otherProps } = entity.toJSON();
    /*
     * `mp_user_id` é descartado aqui de propósito: identifica a conta do músico
     * no provedor e não tem uso no cliente — `mp_linked` responde a única
     * pergunta que a UI faz. Menos superfície, menos vazamento.
     */
    return {
      id: wallet_id,
      ...otherProps,
    } as MusicianWalletOutput;
  }
}
