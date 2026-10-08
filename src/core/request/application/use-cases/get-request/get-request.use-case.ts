import { EventId, IEventRepository } from "../../../../events/domain";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Request, RequestId } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import {
  assertRequestParticipant,
  isRequestViewerScoped,
} from "../common/request-viewer";
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
    // Sem identidade = chamada interna/admin, sem restrição — mesmo convênio
    // de mark-request-played.use-case.ts. O controller HTTP sempre popula os
    // ids a partir do @CurrentUser() autenticado, então a rota segue protegida.
    if (!isRequestViewerScoped(input)) return;

    // O evento só é carregado quando fã e músico não resolvem — o
    // estabelecimento é o caso menos comum e custa uma consulta a mais.
    const viewerIds = input.requesting_participant_ids ?? [];
    const isDirectParticipant =
      viewerIds.includes(entity.audience_id.id) ||
      viewerIds.includes(entity.musician_id.id);

    const event = isDirectParticipant
      ? null
      : await this.eventRepo.findById(new EventId(entity.event_id.id));

    assertRequestParticipant(
      input,
      {
        audience_id: entity.audience_id.id,
        musician_id: entity.musician_id.id,
        establishment_id: event?.establishment_id.id ?? null,
      },
      "este pedido",
    );
  }
}
