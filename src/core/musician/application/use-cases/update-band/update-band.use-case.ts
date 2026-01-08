import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { Currency } from "../../../../shared/domain/value-objects/money.vo";
import { PriceRange } from "../../../../shared/domain/value-objects/price-range.vo";
import { Band, BandId } from "../../../domain/band.aggregate";
import { IBandRepository } from "../../../domain/band.repository";
import { BandOutput, BandOutputMapper } from "../common/band-output";
import { UpdateBandInput } from "./update-band.input";

export class UpdateBandUseCase implements IUseCase<
  UpdateBandInput,
  BandOutput
> {
  constructor(private readonly bandRepo: IBandRepository) {}

  async execute(input: UpdateBandInput): Promise<BandOutput> {
    const bandId = new BandId(input.id);
    const band = await this.bandRepo.findById(bandId);

    if (!band) {
      throw new NotFoundError(input.id, Band);
    }

    if (input.name) {
      band.changeName(input.name);
    }

    if (input.description !== undefined) {
      band.changeDescription(input.description || null);
    }

    if (input.avatar !== undefined) {
      band.changeAvatar(input.avatar || null);
    }

    if (input.genres) {
      band.updateGenres(input.genres);
    }

    if (input.priceRange !== undefined) {
      if (input.priceRange === null) {
        band.changePriceRange(null);
      } else {
        band.changePriceRange(
          new PriceRange({
            model: input.priceRange.model,
            min: input.priceRange.min,
            max: input.priceRange.max,
            currency: input.priceRange.currency as Currency,
            notes: input.priceRange.notes,
          }),
        );
      }
    }

    if (input.is_active !== undefined) {
      if (input.is_active) {
        band.activate();
      } else {
        band.deactivate();
      }
    }

    await this.bandRepo.update(band);

    return BandOutputMapper.toOutput(band);
  }
}
