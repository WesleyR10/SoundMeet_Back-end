import { Inject, Injectable } from "@nestjs/common";

import { SendTipUseCase } from "../../core/payment/application/use-cases/send-tip/send-tip.use-case";
import { ITipRepository } from "../../core/payment/domain/repositories";
import { PaymentMethod, TipId } from "../../core/payment/domain/tip.aggregate";
import {
  BoostChargeCommand,
  BoostChargeResult,
  IBoostChargePort,
} from "../../core/request/domain/ports/boost-charge.port";

/**
 * Liga o destaque do pedido ao domínio de pagamento.
 *
 * O adapter existe para manter a inversão: `core/request` declara a porta e
 * não conhece `core/payment`. Toda a mecânica de gorjeta — taxa do plano,
 * `marketplace_fee`, conta do beneficiário — continua morando no
 * `SendTipUseCase`, que é a fonte única. Reimplementar a cobrança aqui criaria
 * uma segunda verdade sobre quanto a plataforma retém.
 */
@Injectable()
export class BoostChargeAdapter implements IBoostChargePort {
  constructor(
    @Inject(SendTipUseCase)
    private readonly sendTip: SendTipUseCase,
    @Inject("TipRepository")
    private readonly tipRepo: ITipRepository,
  ) {}

  async createCharge(command: BoostChargeCommand): Promise<BoostChargeResult> {
    const result = await this.sendTip.execute({
      audience_id: command.audience_id,
      musician_id: command.musician_id,
      event_id: command.event_id,
      amount: command.amount,
      /*
       * A dedicatória vira a `message` da gorjeta. É o mesmo texto, e duplicar
       * o campo faria a mensagem que o músico lê no palco divergir da que
       * aparece no extrato dele.
       */
      message: command.dedication ?? undefined,
      payment_method: PaymentMethod.PIX,
    });

    return {
      tip_id: result.id,
      qr_code: result.qr_code ?? null,
      copy_paste_code: result.copy_paste_code ?? null,
    };
  }

  async getCharge(tip_id: string): Promise<BoostChargeResult | null> {
    const tip = await this.tipRepo.findById(new TipId(tip_id));
    if (!tip) {
      return null;
    }

    return {
      tip_id: tip.tip_id.id,
      qr_code: tip.pix_qr_code,
      copy_paste_code: tip.pix_copy_paste,
    };
  }
}
