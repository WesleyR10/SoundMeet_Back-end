import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { GetBandInput } from "./get-band.input";

export class GetBandUseCase implements IUseCase<GetBandInput, BandOutput> {
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(input: GetBandInput): Promise<BandOutput> {
    const bandId = new BandId(input.id);
    const entity = await this.bandRepo.findById(bandId);

    if (!entity) {
      throw new NotFoundError(input.id, Band);
    }

    return BandOutputMapper.toOutput(entity);
  }
}
