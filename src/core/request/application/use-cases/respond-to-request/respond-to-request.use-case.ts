import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Request, RequestId } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import {
  RespondToRequestAction,
  RespondToRequestInput,
} from "./respond-to-request.input";

export type RespondToRequestOutput = RequestOutput;

export class RespondToRequestUseCase implements IUseCase<
  RespondToRequestInput,
  RespondToRequestOutput
> {
  constructor(private requestRepo: IRequestRepository) {}

  async execute(input: RespondToRequestInput): Promise<RespondToRequestOutput> {
    const requestId = new RequestId(input.request_id);
    const entity = await this.requestRepo.findById(requestId);

    if (!entity) {
      throw new NotFoundError(input.request_id, Request);
    }

    // Validar que apenas o músico destinatário pode responder
    if (entity.musician_id.id !== input.musician_id) {
      throw new EntityValidationError([
        {
          musician_id: ["You can only respond to requests directed to you"],
        },
      ]);
    }

    // Validar que o pedido está pendente
    if (!entity.isPending) {
      throw new EntityValidationError([
        {
          status: ["Only pending requests can be responded to"],
        },
      ]);
    }

    // Validar regras de negócio específicas para aceitar/rejeitar
    if (input.action === RespondToRequestAction.ACCEPT) {
      if (!entity.canBeAccepted()) {
        throw new EntityValidationError([
          {
            status: [
              "This request cannot be accepted (too old or invalid status)",
            ],
          },
        ]);
      }
    } else if (input.action === RespondToRequestAction.REJECT) {
      if (!entity.canBeRejected()) {
        throw new EntityValidationError([
          {
            status: ["This request cannot be rejected"],
          },
        ]);
      }
    }

    // Validar se ainda está dentro do tempo de resposta
    if (!entity.isWithinResponseTime()) {
      throw new EntityValidationError([
        {
          created_at: ["Request has expired - response time limit exceeded"],
        },
      ]);
    }

    // Executar ação
    if (input.action === RespondToRequestAction.ACCEPT) {
      entity.accept();
    } else if (input.action === RespondToRequestAction.REJECT) {
      entity.reject(input.rejection_reason);
    } else {
      throw new EntityValidationError([
        {
          action: ["Action must be either 'accept' or 'reject'"],
        },
      ]);
    }

    await this.requestRepo.update(entity);

    return RequestOutputMapper.toOutput(entity);
  }
}
