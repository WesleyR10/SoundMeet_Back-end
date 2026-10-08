import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { IBoostChargePort } from "../../../domain/ports/boost-charge.port";
import { Request, RequestId } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
import { RequestBoostStatusEnum } from "../../../domain/value-objects/request-boost.vo";
import {
  assertRequestParticipant,
  RequestViewer,
} from "../common/request-viewer";

export type GetRequestBoostPaymentInput = {
  request_id: string;
} & RequestViewer;

export type GetRequestBoostPaymentOutput = {
  request_id: string;
  song_title: string;
  artist: string | null;
  amount: number;
  dedication: string | null;
  status: RequestBoostStatusEnum;
  tip_id: string | null;
  qr_code: string | null;
  copy_paste_code: string | null;
  /** Quando o destaque deixa de valer se ninguém pagar. */
  expires_at: Date | null;
};

/**
 * O QR da cobrança do destaque, relido a qualquer momento.
 *
 * Existe porque a cobrança nasce no ACEITE do músico — o fã não está na tela
 * nesse instante. Sem esta rota, o único caminho até o QR seria a notificação
 * em tempo real, e quem estivesse com o app fechado nunca conseguiria pagar.
 */
export class GetRequestBoostPaymentUseCase implements IUseCase<
  GetRequestBoostPaymentInput,
  GetRequestBoostPaymentOutput
> {
  constructor(
    private readonly requestRepo: IRequestRepository,
    private readonly boostCharge: IBoostChargePort,
    private readonly paymentWindowMinutes: number,
  ) {}

  async execute(
    input: GetRequestBoostPaymentInput,
  ): Promise<GetRequestBoostPaymentOutput> {
    const entity = await this.requestRepo.findById(
      new RequestId(input.request_id),
    );

    if (!entity) {
      throw new NotFoundError(input.request_id, Request);
    }

    /*
     * O guard de rota prova QUEM é o usuário; ele não prova de quem é o
     * pedido. Sem esta checagem, qualquer autenticado leria a cobrança (e a
     * dedicatória) de qualquer pedido pelo id.
     */
    assertRequestParticipant(
      input,
      {
        audience_id: entity.audience_id.id,
        musician_id: entity.musician_id.id,
      },
      "a cobrança deste pedido",
    );

    if (!entity.boost) {
      throw new NotFoundError(input.request_id, Request);
    }

    /*
     * O payload só é buscado quando há cobrança de verdade. Em `promised` o
     * músico ainda não aceitou e não existe nada a pagar; em `cancelled` nunca
     * vai existir. Devolver o estado (em vez de 404) deixa a UI explicar o
     * que está acontecendo em vez de mostrar erro.
     */
    const charge = entity.boost.tip_id
      ? await this.boostCharge.getCharge(entity.boost.tip_id)
      : null;

    return {
      request_id: entity.request_id.id,
      song_title: entity.song_title.value,
      artist: entity.artist,
      amount: entity.boost.amount.amount,
      dedication: entity.boost.dedication,
      status: entity.boost.status,
      tip_id: entity.boost.tip_id,
      qr_code: charge?.qr_code ?? null,
      copy_paste_code: charge?.copy_paste_code ?? null,
      expires_at: entity.boost.expiresAt(this.paymentWindowMinutes),
    };
  }
}
