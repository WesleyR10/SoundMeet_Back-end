import { Inject, Injectable } from "@nestjs/common";

import { IMusicianWalletRepository } from "../../core/payment/domain/repositories/musician-wallet.repository";
import { ITipEligibilityPort } from "../../core/request/domain/ports/tip-eligibility.port";

/**
 * O músico consegue receber gorjeta hoje?
 *
 * 🔴 A resposta é o vínculo OAuth com o provedor, não uma flag de perfil: a
 * cobrança é criada NA CONTA DELE (`MercadoPagoPixGateway`), então sem vínculo
 * não existe para onde o dinheiro ir — e o gateway recusa com
 * `MercadoPagoAccountNotLinkedError`.
 *
 * Consultado na CRIAÇÃO do pedido, para que o fã descubra isso antes de
 * prometer, e não o músico depois de aceitar. Ver `ITipEligibilityPort`.
 */
@Injectable()
export class TipEligibilityAdapter implements ITipEligibilityPort {
  constructor(
    @Inject("MusicianWalletRepository")
    private readonly walletRepo: IMusicianWalletRepository,
  ) {}

  async acceptsTips(musician_id: string): Promise<boolean> {
    const wallet = await this.walletRepo.findByMusicianId(musician_id);
    return wallet?.hasMercadoPagoLink ?? false;
  }
}
