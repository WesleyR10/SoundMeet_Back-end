import { Logger } from "@nestjs/common";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { IRequestRepository } from "../../../domain/request.repository";

export type MarkRequestBoostPaidInput = {
  /** Id da gorjeta confirmada pelo provedor. */
  tip_id: string;
  paid_at?: Date;
};

export type MarkRequestBoostPaidOutput = {
  /** `null` quando a gorjeta não veio de um pedido (gorjeta avulsa). */
  request_id: string | null;
  audience_id: string | null;
  musician_id: string | null;
  song_title: string | null;
  dedication: string | null;
  amount: number | null;
};

/**
 * Fecha o ciclo do destaque quando o webhook confirma o PIX.
 *
 * Roda como handler de `TipCompletedEvent`, nunca inline na confirmação do
 * pagamento: `RequestPrismaRepository` não participa de `UnitOfWork`, então
 * escrever nos dois agregados na mesma chamada daria aparência de transação
 * sem a garantia. E falhar a confirmação de uma gorjeta — dinheiro real, já
 * aprovado no provedor — por causa de um status secundário seria o pior
 * resultado possível.
 */
export class MarkRequestBoostPaidUseCase implements IUseCase<
  MarkRequestBoostPaidInput,
  MarkRequestBoostPaidOutput
> {
  private readonly logger = new Logger(MarkRequestBoostPaidUseCase.name);

  constructor(
    private readonly requestRepo: IRequestRepository,
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(
    input: MarkRequestBoostPaidInput,
  ): Promise<MarkRequestBoostPaidOutput> {
    const entity = await this.requestRepo.findByBoostTipId(input.tip_id);

    /*
     * Gorjeta avulsa (enviada do perfil do músico, fora de um pedido) não tem
     * pedido para marcar. Não é erro — é o caminho mais comum de gorjeta.
     */
    if (!entity?.boost) {
      return {
        request_id: null,
        audience_id: null,
        musician_id: null,
        song_title: null,
        dedication: null,
        amount: null,
      };
    }

    /*
     * Reentrega do webhook. O `processOnce` do chamador já barra a maioria,
     * mas um destaque já pago (ou já mandado a reembolso) nunca deve transitar
     * de novo — seria transição ilegal e derrubaria o handler.
     *
     * Pedido RECUSADO que recebe o PIX vira `refund_pending` dentro de
     * `markBoostPaid` (agregado): o evento publicado aí é o de reembolso, não
     * o de pago — sem destaque, sem dedicatória pública.
     */
    if (entity.boost.isPaid || entity.boost.isRefundPending) {
      return this.toOutput(entity);
    }

    entity.markBoostPaid(input.paid_at);
    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.requestRepo.update(entity);

    /*
     * `RequestBoostPaidEvent` é o que avisa fã e músico (no notifications-module,
     * que é nó-folha). Publicado DEPOIS do update: um evento que anuncia
     * pagamento confirmado antes de o banco confirmar dispararia a celebração
     * de um estado que ainda pode falhar.
     */
    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(entity);
      await this.domainEventMediator.publishIntegrationEvents(entity);
      entity.clearEvents();
    }

    this.logger.log(
      JSON.stringify({
        event: "request.boost.paid",
        request_id: entity.request_id.id,
        tip_id: input.tip_id,
      }),
    );

    return this.toOutput(entity);
  }

  private toOutput(
    entity: NonNullable<
      Awaited<ReturnType<IRequestRepository["findByBoostTipId"]>>
    >,
  ): MarkRequestBoostPaidOutput {
    return {
      request_id: entity.request_id.id,
      audience_id: entity.audience_id.id,
      musician_id: entity.musician_id.id,
      song_title: entity.song_title.value,
      dedication: entity.boost?.dedication ?? null,
      amount: entity.boost?.amount.amount ?? null,
    };
  }
}
