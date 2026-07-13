import { IMusicianWalletRepository, MusicianWallet } from "@core/payment";
import { PlanCheckService } from "@core/plans/domain/plan-check.service";

import { IUseCase } from "../../../../shared/application/use-case.interface";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import {
  MusicianWalletOutput,
  MusicianWalletOutputMapper,
} from "../common/musician-wallet-output";

export type UpdateMusicianPixKeyInput = {
  musician_id: string;
  pix_key: string;
  pix_key_type: string;
};

export type UpdateMusicianPixKeyOutput = MusicianWalletOutput & {
  min_withdrawal_amount_brl: number;
  withdrawal_days: number;
};

export class UpdateMusicianPixKeyUseCase implements IUseCase<
  UpdateMusicianPixKeyInput,
  UpdateMusicianPixKeyOutput
> {
  constructor(
    private readonly walletRepository: IMusicianWalletRepository,
    private readonly planCheckService?: PlanCheckService,
  ) {}

  async execute(
    input: UpdateMusicianPixKeyInput,
  ): Promise<UpdateMusicianPixKeyOutput> {
    let wallet = await this.walletRepository.findByMusicianId(
      input.musician_id,
    );

    if (!wallet) {
      // If wallet doesn't exist, create it (lazy creation pattern)
      wallet = MusicianWallet.create({ musician_id: input.musician_id });
      await this.walletRepository.insert(wallet);
    }

    wallet.updatePixKey(input.pix_key, input.pix_key_type);

    if (wallet.notification.hasErrors()) {
      throw new EntityValidationError(wallet.notification.toJSON());
    }
    await this.walletRepository.update(wallet);

    const withdrawalConfig = this.planCheckService
      ? await this.planCheckService.getMusicianWithdrawalConfig(input.musician_id)
      : { min_amount_brl: 110, days: 5 };

    return {
      ...MusicianWalletOutputMapper.toOutput(wallet),
      min_withdrawal_amount_brl: withdrawalConfig.min_amount_brl,
      withdrawal_days: withdrawalConfig.days,
    };
  }
}
