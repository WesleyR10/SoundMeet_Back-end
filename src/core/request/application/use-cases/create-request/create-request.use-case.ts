import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Request } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import { CreateRequestInput } from "./create-request.input";

export type CreateRequestOutput = RequestOutput;

export class CreateRequestUseCase
  implements IUseCase<CreateRequestInput, CreateRequestOutput>
{
  constructor(private requestRepo: IRequestRepository) {}

  async execute(input: CreateRequestInput): Promise<CreateRequestOutput> {
    // Validar limite diário de pedidos por usuário
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const requestsToday =
      await this.requestRepo.countRequestsByAudienceInPeriod(
        input.audience_id,
        today,
        tomorrow,
      );

    const DAILY_REQUEST_LIMIT = 10; // Limite configurável
    if (requestsToday >= DAILY_REQUEST_LIMIT) {
      throw new EntityValidationError([
        {
          audience_id: [
            `Daily request limit of ${DAILY_REQUEST_LIMIT} exceeded`,
          ],
        },
      ]);
    }

    // Verificar se já existe um pedido pendente do mesmo usuário para o mesmo músico
    const existingRequests =
      await this.requestRepo.findRequestsByAudienceAndMusician(
        input.audience_id,
        input.musician_id,
      );

    const hasPendingRequest = existingRequests.some(
      (request) => request.isPending,
    );
    if (hasPendingRequest) {
      throw new EntityValidationError([
        {
          musician_id: ["You already have a pending request for this musician"],
        },
      ]);
    }

    // Verificar pedidos similares recentes (últimas 2 horas)
    const recentRequests = await this.requestRepo.findRecentRequestsByAudience(
      input.audience_id,
      2, // últimas 2 horas
    );

    const tempRequest = Request.create({
      audience_id: input.audience_id,
      musician_id: input.musician_id,
      song_title: input.song_title,
      artist: input.artist,
      message: input.message,
    });

    const hasSimilarRecentRequest = recentRequests.some((request) =>
      tempRequest.isSimilarTo(request),
    );

    if (hasSimilarRecentRequest) {
      throw new EntityValidationError([
        {
          song_title: ["You have already requested this song recently"],
        },
      ]);
    }

    const entity = tempRequest;

    // Remover validação adicional pois o método create já valida
    // if (entity.notification.hasErrors()) {
    //   throw new EntityValidationError(entity.notification.toJSON());
    // }

    await this.requestRepo.insert(entity);

    return RequestOutputMapper.toOutput(entity);
  }
}
