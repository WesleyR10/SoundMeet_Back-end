import {
  IMusicianWalletRepository,
  MusicianWallet,
  MusicianWalletOutput,
  MusicianWalletOutputMapper,
} from "@core/payment";
import { PlanCheckService } from "@core/plans/domain/plan-check.service";
import { IUseCase } from "@core/shared/application/use-case.interface";
import { NotFoundError } from "@core/shared/domain/errors";

export type GetMusicianWalletInput = {
  musician_id: string;
};

export type GetMusicianWalletOutput = MusicianWalletOutput & {
  min_withdrawal_amount_brl: number;
  withdrawal_days: number;
};

export class GetMusicianWalletUseCase implements IUseCase<
  GetMusicianWalletInput,
  GetMusicianWalletOutput
> {
  constructor(
    private readonly walletRepository: IMusicianWalletRepository,
    private readonly planCheckService?: PlanCheckService,
  ) {}

  async execute(
    input: GetMusicianWalletInput,
  ): Promise<GetMusicianWalletOutput> {
    const [wallet, withdrawalConfig] = await Promise.all([
      this.walletRepository.findByMusicianId(input.musician_id),
      this.planCheckService
        ? this.planCheckService.getMusicianWithdrawalConfig(input.musician_id)
        : Promise.resolve({ min_amount_brl: 110, days: 5 }),
    ]);

    if (!wallet) {
      throw new NotFoundError(input.musician_id, MusicianWallet);
    }

    return {
      ...MusicianWalletOutputMapper.toOutput(wallet),
      min_withdrawal_amount_brl: withdrawalConfig.min_amount_brl,
      withdrawal_days: withdrawalConfig.days,
    };
  }
}
