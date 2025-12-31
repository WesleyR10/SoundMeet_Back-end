import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Request } from "../../../domain/request.aggregate";
import { RequestId } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
import { RequestOutput, RequestOutputMapper } from "../common/request-output";
import { UpdateRequestInput } from "./update-request.input";

export class UpdateRequestUseCase implements IUseCase<
  UpdateRequestInput,
  UpdateRequestOutput
> {
  constructor(private readonly requestRepo: IRequestRepository) {}

  async execute(input: UpdateRequestInput): Promise<RequestOutput> {
    const entity = await this.requestRepo.findById(new RequestId(input.id));
    if (!entity) {
      throw new NotFoundError(input.id, Request);
    }

    if (input.song_title !== undefined) {
      entity.changeSongTitle(input.song_title);
    }

    if (input.artist !== undefined) {
      entity.changeArtist(input.artist);
    }

    if (input.message !== undefined) {
      entity.changeMessage(input.message);
    }

    entity.validate();

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.requestRepo.update(entity);
    return RequestOutputMapper.toOutput(entity);
  }
}

export type UpdateRequestOutput = RequestOutput;
