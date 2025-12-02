import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Band } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { CreateBandInput } from "./create-band.input";

export class CreateBandUseCase
  implements IUseCase<CreateBandInput, BandOutput>
{
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(input: CreateBandInput): Promise<BandOutput> {
    const entity = Band.create({
      name: input.name,
      description: input.description,
      avatar: input.avatar,
      genres: input.genres,
      members: input.members || [],
      is_active: input.is_active,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.bandRepo.insert(entity);

    return BandOutputMapper.toOutput(entity);
  }
}
