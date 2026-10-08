import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { MusicianWallet } from "../../../domain/musician-wallet.aggregate";
import { IMusicianWalletRepository } from "../../../domain/repositories/musician-wallet.repository";

export type DisconnectMercadoPagoInput = { musician_id: string };
export type DisconnectMercadoPagoOutput = {
  musician_id: string;
  linked: boolean;
};

/**
 * O músico desvincula a conta Mercado Pago.
 *
 * Não há saldo a proteger: diferente da custódia do cachê, a gorjeta já caiu na
 * conta dele no momento do pagamento. Desvincular só impede gorjetas novas — e
 * é por isso que, ao contrário de `disableEscrow`, não existe checagem de saldo
 * retido aqui.
 */
export class DisconnectMercadoPagoUseCase implements IUseCase<
  DisconnectMercadoPagoInput,
  DisconnectMercadoPagoOutput
> {
  constructor(private readonly walletRepo: IMusicianWalletRepository) {}

  async execute(
    input: DisconnectMercadoPagoInput,
  ): Promise<DisconnectMercadoPagoOutput> {
    const wallet = await this.walletRepo.findByMusicianId(input.musician_id);
    if (!wallet) {
      throw new NotFoundError(input.musician_id, MusicianWallet);
    }

    wallet.unlinkMercadoPago();
    await this.walletRepo.update(wallet);

    return { musician_id: input.musician_id, linked: false };
  }
}
