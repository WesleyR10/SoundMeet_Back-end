import { Logger } from "@nestjs/common";

import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IRequestRepository } from "../../../domain/request.repository";

export type ExpireStaleRequestBoostsOutput = {
  expired: string[];
};

/**
 * Vence o PIX de destaque que o fã gerou ao pedir e não pagou na janela.
 *
 * O pedido SEGUE (pendente ou aceito) como pedido comum — e como PIX não pago
 * nunca destacou (paga antes, destaca depois), a fila não muda. O que o
 * vencimento faz é parar de oferecer o QR como pendência ao fã. Se ele pagar
 * mesmo assim, `markBoostPaid` ainda honra o pagamento enquanto o pedido
 * estiver aberto.
 *
 * Nada a estornar: em `awaiting_payment` nenhum dinheiro entrou.
 */
export class ExpireStaleRequestBoostsUseCase implements IUseCase<
  void,
  ExpireStaleRequestBoostsOutput
> {
  private readonly logger = new Logger(ExpireStaleRequestBoostsUseCase.name);

  constructor(
    private readonly requestRepo: IRequestRepository,
    private readonly paymentWindowMinutes: number,
    private readonly clock: IClock = { now: () => new Date() },
  ) {}

  async execute(): Promise<ExpireStaleRequestBoostsOutput> {
    const cutoff = new Date(
      this.clock.now().getTime() - this.paymentWindowMinutes * 60 * 1000,
    );

    const stale =
      await this.requestRepo.findBoostsAwaitingPaymentBefore(cutoff);

    const expired: string[] = [];

    for (const entity of stale) {
      /*
       * Um pedido que falha não pode levar a varredura inteira junto: o
       * próximo destaque vencido ficaria no topo da fila indefinidamente,
       * ocupando a posição que ninguém pagou.
       */
      try {
        entity.markBoostExpired();
        if (entity.notification.hasErrors()) {
          throw new Error(JSON.stringify(entity.notification.toJSON()));
        }
        await this.requestRepo.update(entity);
        expired.push(entity.request_id.id);
      } catch (error) {
        this.logger.error(
          JSON.stringify({
            event: "request.boost.expire_failed",
            request_id: entity.request_id.id,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }

    if (expired.length > 0) {
      this.logger.log(
        JSON.stringify({
          event: "request.boost.expired",
          count: expired.length,
        }),
      );
    }

    return { expired };
  }
}
