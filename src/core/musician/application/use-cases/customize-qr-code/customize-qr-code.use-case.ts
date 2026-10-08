import { PlanCheckService } from "../../../../plans/domain/plan-check.service";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { QRCustomizationPatch } from "../../../../shared/domain/value-objects/qr-code.vo";
import { Musician, MusicianId } from "../../../domain/musician.aggregate";
import { IMusicianRepository } from "../../../domain/musician.repository";
import { IMusicianStorage } from "../../ports/musician-storage.interface";
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
    // Opcional: sem storage a customização funciona igual, só não limpa o
    // bucket ao remover o logo (o comportamento que havia até out/2026).
    private readonly storage?: IMusicianStorage,
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

    const removedLogoKey = musician.customizeQRCode(input.customization);

    await this.musicianRepo.update(musician);

    // Remover o logo (`logo_url: null`) também apaga o arquivo. Antes só a URL
    // saía do perfil e o objeto ficava no bucket para sempre.
    if (removedLogoKey && this.storage) {
      await this.storage
        .deleteObject({ object_key: removedLogoKey })
        .catch(() => undefined);
    }

    return MusicianOutputMapper.toOutput(musician);
  }
}
