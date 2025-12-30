import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Request } from "../../../domain/request.aggregate";
import { RequestId } from "../../../domain/request.aggregate";
import { IRequestRepository } from "../../../domain/request.repository";
import { DeleteRequestInput } from "./delete-request.input";

export type DeleteRequestOutput = void;

export class DeleteRequestUseCase implements IUseCase<
  DeleteRequestInput,
  DeleteRequestOutput
> {
  constructor(private readonly requestRepo: IRequestRepository) {}

  async execute(input: DeleteRequestInput): Promise<DeleteRequestOutput> {
    try {
      const requestId = new RequestId(input.id);
      const entity = await this.requestRepo.findById(requestId);

      if (!entity) {
        throw new NotFoundError(input.id, Request);
      }

      await this.requestRepo.delete(requestId);
    } catch (error) {
      // Se o UUID for inválido, tratar como NotFoundError
      if (error.message?.includes("Invalid UUID")) {
        throw new NotFoundError(input.id, Request);
      }
      throw error;
    }
  }
}
