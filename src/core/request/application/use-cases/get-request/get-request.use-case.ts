import { ForbiddenException } from "@nestjs/common";

import { EventId, IEventRepository } from "../../../../events/domain";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Request, RequestId } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import { GetRequestInput } from "./get-request.input";

export type GetRequestOutput = RequestOutput;

export class GetRequestUseCase implements IUseCase<
  GetRequestInput,
  GetRequestOutput
> {
  constructor(
    private requestRepo: IRequestRepository,
    private eventRepo: IEventRepository,
  ) {}

  async execute(input: GetRequestInput): Promise<GetRequestOutput> {
    const requestId = new RequestId(input.id);
    const entity = await this.requestRepo.findById(requestId);

    if (!entity) {
      throw new NotFoundError(input.id, Request);
    }

    await this.ensureCanView(entity, input);

    return RequestOutputMapper.toOutput(entity);
  }

  // Escopo a participantes: quem pediu (audience), o músico-alvo, ou o
  // estabelecimento dono do evento do pedido. Admin pula a checagem.
  private async ensureCanView(
    entity: Request,
    input: GetRequestInput,
  ): Promise<void> {
    // requesting_user_id ausente = chamada interna/admin, sem restrição —
    // mesmo convênio de mark-request-played.use-case.ts (identidade
    // undefined pula a checagem de ownership). O controller HTTP sempre
    // popula esse campo a partir do @CurrentUser() autenticado, então a
    // rota pública continua protegida.
    if (input.is_admin || !input.requesting_user_id) return;

    if (
      entity.audience_id.id === input.requesting_user_id ||
      entity.musician_id.id === input.requesting_user_id
    ) {
      return;
    }

    const event = await this.eventRepo.findById(
      new EventId(entity.event_id.id),
    );
    if (event && event.establishment_id.id === input.requesting_user_id) {
      return;
    }

    throw new ForbiddenException(
      "Você não tem permissão para ver este pedido.",
    );
  }
}
