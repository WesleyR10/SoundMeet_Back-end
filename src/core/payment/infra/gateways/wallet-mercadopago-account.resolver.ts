import { IMusicianWalletRepository } from "../../domain/repositories/musician-wallet.repository";
import {
  IMercadoPagoAccountResolver,
  MercadoPagoAccount,
} from "./mercadopago-account.resolver";

/**
 * Resolve a conta Mercado Pago do músico a partir da carteira.
 *
 * Os tokens ficam cifrados em repouso; o repositório já os devolve decifrados
 * pelo mapper, então esta classe não conhece criptografia — ela só traduz
 * "músico" em "credencial", que é o que o adapter HTTP precisa.
 *
 * ⚠️ **Não renova token vencido aqui.** A renovação é do job
 * (`RefreshMercadoPagoTokensJob`), que roda com folga antes do vencimento.
 * Renovar no caminho quente de uma gorjeta acrescentaria uma chamada de rede a
 * um fluxo em que o fã está esperando o QR na tela — e, se o provedor demorasse,
 * a gorjeta falharia por causa de manutenção, não de pagamento.
 */
export class WalletMercadoPagoAccountResolver implements IMercadoPagoAccountResolver {
  constructor(private readonly walletRepo: IMusicianWalletRepository) {}

  async resolve(musicianId: string): Promise<MercadoPagoAccount | null> {
    const wallet = await this.walletRepo.findByMusicianId(musicianId);

    if (!wallet?.hasMercadoPagoLink) {
      return null;
    }

    return {
      mp_user_id: wallet.mp_user_id!,
      access_token: wallet.mp_access_token!,
    };
  }
}
