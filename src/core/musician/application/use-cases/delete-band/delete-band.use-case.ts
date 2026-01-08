import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { DeleteBandInput } from "./delete-band.input";

export type DeleteBandOutput = void;

export class DeleteBandUseCase implements IUseCase<
  DeleteBandInput,
  DeleteBandOutput
> {
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(input: DeleteBandInput): Promise<DeleteBandOutput> {
    const bandId = new BandId(input.id);
    const band = await this.bandRepo.findById(bandId);

    if (!band) {
      throw new NotFoundError(input.id, Band);
    }

    await this.bandRepo.delete(bandId);
  }
}
