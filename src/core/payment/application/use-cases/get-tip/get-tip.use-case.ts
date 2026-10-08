import { IUseCase } from "@core/shared/application/use-case.interface";
import { NotFoundError } from "@core/shared/domain/errors";
import { ForbiddenException } from "@nestjs/common";

import { ITipRepository } from "../../../domain/repositories";
import { Tip, TipId } from "../../../domain/tip.aggregate";

export type GetTipInput = {
  tip_id: string;
  /** `sub` do JWT. Sempre exigido: gorjeta é dado financeiro. */
  requesting_user_id: string;
  is_admin?: boolean;
};

export type GetTipOutput = {
  id: string;
  status: string;
  amount: number;
  musician_id: string | null;
  band_id: string | null;
  event_id: string | null;
  message: string | null;
  qr_code: string | null;
  copy_paste_code: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * O fã relê a própria gorjeta.
 *
 * ## Por que existia um buraco aqui
 *
 * O PIX é assíncrono: o app mostra o QR e nunca mais fica sabendo de nada. Sem
 * esta rota o fã não tinha como descobrir que o pagamento foi confirmado — o
 * socket cobre quem está com o app aberto, e este é o caminho de quem voltou
 * depois. É o que permite a celebração acontecer no cold start em vez de se
 * perder.
 *
 * 🔴 **Só o dono lê.** O guard de rota prova quem é o usuário; ele não prova
 * de quem é a gorjeta. Sem esta checagem, qualquer autenticado leria valor,
 * mensagem e destinatário de qualquer gorjeta pelo id — e o código PIX junto.
 */
export class GetTipUseCase implements IUseCase<GetTipInput, GetTipOutput> {
  constructor(private readonly tipRepo: ITipRepository) {}

  async execute(input: GetTipInput): Promise<GetTipOutput> {
    const tip = await this.tipRepo.findById(new TipId(input.tip_id));

    if (!tip) {
      throw new NotFoundError(input.tip_id, Tip);
    }

    if (!input.is_admin && tip.audience_id.id !== input.requesting_user_id) {
      throw new ForbiddenException("Esta gorjeta não é sua.");
    }

    return {
      id: tip.tip_id.id,
      status: tip.status,
      amount: tip.amount.amount,
      musician_id: tip.musician_id?.id ?? null,
      band_id: tip.band_id?.id ?? null,
      event_id: tip.event_id?.id ?? null,
      message: tip.message,
      qr_code: tip.pix_qr_code,
      copy_paste_code: tip.pix_copy_paste,
      created_at: tip.created_at,
      updated_at: tip.updated_at,
    };
  }
}
