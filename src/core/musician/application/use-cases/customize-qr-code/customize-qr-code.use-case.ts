import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { QRCustomizationPatch } from "../../../../shared/domain/value-objects/qr-code.vo";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import {
  MusicianOutput,
  MusicianOutputMapper,
} from "../common/musician-profile-output";

export type CustomizeQRCodeInput = {
  musician_id: string;
  customization: QRCustomizationPatch;
};

export type CustomizeQRCodeOutput = MusicianOutput;

export class CustomizeQRCodeUseCase implements IUseCase<
  CustomizeQRCodeInput,
  CustomizeQRCodeOutput
> {
  constructor(
    private readonly musicianRepo: IMusicianRepository,
    private readonly planCheckService: PlanCheckService,
  ) {}

  async execute(input: CustomizeQRCodeInput): Promise<CustomizeQRCodeOutput> {
    await this.planCheckService.assertMusicianFeature(
      input.musician_id,
      "custom_qr_code",
    );

    const musicianId = new MusicianId(input.musician_id);
    const musician = await this.musicianRepo.findById(musicianId);

    if (!musician) {
      throw new NotFoundError(input.musician_id, Musician);
    }

    musician.customizeQRCode(input.customization);

    await this.musicianRepo.update(musician);

    return MusicianOutputMapper.toOutput(musician);
  }
}
