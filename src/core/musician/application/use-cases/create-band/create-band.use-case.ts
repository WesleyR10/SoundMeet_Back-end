import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { PriceRange } from "../../../../shared/domain/value-objects/price-range.vo";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";
import { Band, BandMemberProps } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { CreateBandInput } from "./create-band.input";

export class CreateBandUseCase implements IUseCase<
  CreateBandInput,
  BandOutput
> {
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(input: CreateBandInput): Promise<BandOutput> {
    const existingMembers: BandMemberProps[] = input.members || [];

    const members: BandMemberProps[] = input.creator_musician_id
      ? [
          {
            musician_id: new Uuid(input.creator_musician_id),
            role: "leader",
            instrument: "N/A",
            joined_at: new Date(),
          },
          ...existingMembers.filter(
            (m) => m.musician_id.id !== input.creator_musician_id,
          ),
        ]
      : existingMembers;

    const entity = Band.create({
      name: input.name,
      description: input.description,
      avatar: input.avatar,
      genres: input.genres,
      members,
      priceRange: input.priceRange ? new PriceRange(input.priceRange) : null,
      is_active: input.is_active,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.bandRepo.insert(entity);

    return BandOutputMapper.toOutput(entity);
  }
}
